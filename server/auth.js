import { createHash, randomBytes } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { first, rows } from './db.js';

export const digest = text => createHash('sha256').update(text).digest('hex');
export const token = () => randomBytes(32).toString('base64url');
export const cookie = (req, name) => req.headers.cookie?.match(new RegExp('(?:^|; *)'+name+'=([A-Za-z0-9_-]+)'))?.[1];
export const fail = (status,message) => Object.assign(new Error(message),{status});

export function authentication(app,db,cfg,demoUsers) {
  const redirect = cfg.url.origin + '/api/auth/google/callback';
  const google = new OAuth2Client(cfg.googleId,cfg.googleSecret,redirect);
  const options = { httpOnly:true,sameSite:'lax',secure:cfg.url.protocol==='https:',path:'/' };
  async function openSession(req,res,id) {
    await dropSession(req,res);
    await rows(db,'DELETE FROM sessions WHERE expires_at < now()');
    const raw = token();
    await rows(db,"INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ($1,$2, now() + interval '12 hours')",digest(raw),id);
    res.cookie('elite_session',raw,{...options,maxAge:43200000});
  }
  async function dropSession(req,res) {
    const raw = cookie(req,'elite_session');
    if (raw) await rows(db,'DELETE FROM sessions WHERE token_hash=$1',digest(raw));
    res.clearCookie('elite_session',options);
  }
  async function current(req) {
    const raw = cookie(req,'elite_session');
    if (!raw) return null;
    return await first(db,`SELECT u.id,u.email,u.role,u.name FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=$1 AND s.expires_at > now() AND u.is_active`,digest(raw)) ?? null;
  }
  app.get('/api/session',async(req,res)=>res.json({user:await current(req),demo:cfg.demo,device_id:cfg.device}));
  app.post('/api/auth/logout',async(req,res)=>{await dropSession(req,res);res.sendStatus(204);});

  if (cfg.demo) {
    app.post('/api/auth/demo',async(req,res)=>{
      const role = req.body?.role;
      if (!['admin','viewer'].includes(role)) throw fail(400,'Pilih peran demo.');
      await openSession(req,res,demoUsers[role]);
      res.json({ok:true});
    });
  } else {
    app.get('/api/auth/google',async(req,res)=>{
      const state=token(), nonce=token(), verifier=token();
      const challenge=createHash('sha256').update(verifier).digest('base64url');
      await rows(db,'DELETE FROM oauth_attempts WHERE expires_at < now()');
      await rows(db,"INSERT INTO oauth_attempts VALUES ($1,$2,$3,now() + interval '10 minutes')",digest(state),verifier,nonce);
      res.cookie('elite_oauth',state,{...options,maxAge:600000});
      res.redirect(google.generateAuthUrl({scope:['openid','email','profile'],state,nonce,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'}));
    });
    app.get('/api/auth/google/callback',async(req,res)=>{
      res.clearCookie('elite_oauth',options);
      const { state,code }=req.query;
      try {
        if (typeof state!=='string'||typeof code!=='string'||state!==cookie(req,'elite_oauth')) throw fail(403,'Sesi login sudah berakhir.');
        const attempt=await first(db,'DELETE FROM oauth_attempts WHERE state_hash=$1 AND expires_at>now() RETURNING verifier,nonce',digest(state));
        if (!attempt) throw fail(403,'Sesi login sudah berakhir.');
        const { tokens }=await google.getToken({code,codeVerifier:attempt.verifier});
        const ticket=await google.verifyIdToken({idToken:tokens.id_token,audience:cfg.googleId});
        const info=ticket.getPayload();
        const email=info.email?.toLowerCase();
        if (!info.email_verified || info.nonce!==attempt.nonce || !email?.endsWith('@gmail.com')) throw fail(403,'Gunakan Gmail terverifikasi yang diundang.');
        const user=await first(db,`UPDATE users SET google_sub=$2,name=$3,avatar_url=$4
          WHERE email=$1 AND is_active AND (google_sub IS NULL OR google_sub=$2) RETURNING id`,email,info.sub,info.name??null,info.picture??null);
        if (!user) throw fail(403,'Akses Gmail belum diaktifkan.');
        await openSession(req,res,user.id);
        res.redirect('/#/beranda');
      } catch (error) {
        res.redirect('/?login='+(error.status===403?'access':'failed'));
      }
    });
  }
  return async (req,res,next)=>{
    req.user=await current(req);
    if (!req.user) throw fail(401,'Silakan masuk terlebih dahulu.');
    next();
  };
}
export function admin(req,res,next) {
  if (req.user.role!=='admin') throw fail(403,'Fitur ini khusus admin.');
  next();
}
