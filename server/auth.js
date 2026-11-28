import { SESSION_HOURS, SESSION_MS } from './session-duration.js';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';
import { first, rows } from './db.js';

export const digest = text => createHash('sha256').update(text).digest('hex');
export const token = () => randomBytes(32).toString('base64url');
export const cookie = (req, name) => req.headers.cookie?.match(new RegExp('(?:^|; *)'+name+'=([A-Za-z0-9_-]+)'))?.[1];
export const fail = (status,message) => Object.assign(new Error(message),{status});

const derive=promisify(scrypt);
export async function passwordHash(password) {
  const salt=randomBytes(16).toString('hex');
  return salt+':'+(await derive(password,salt,64)).toString('hex');
}

export const usernameField=z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{2,39}$/);

export function authentication(app,db,cfg) {

  const options = { httpOnly:true,sameSite:'lax',secure:cfg.url.protocol==='https:',path:'/' };
  async function openSession(req,res,id) {
    await dropSession(req,res);
    await rows(db,'DELETE FROM sessions WHERE expires_at < now()');
    const raw = token();
    await rows(db,"INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ($1,$2, now() + $3::int * interval '1 hour')",digest(raw),id,SESSION_HOURS);
    res.cookie('elite_session',raw,{...options,maxAge:SESSION_MS});
  }
  async function dropSession(req,res) {
    const raw = cookie(req,'elite_session');
    if (raw) await rows(db,'DELETE FROM sessions WHERE token_hash=$1',digest(raw));
    res.clearCookie('elite_session',options);
  }
  async function current(req) {
    const raw = cookie(req,'elite_session');
    if (!raw) return null;
    return await first(db,`SELECT u.id,u.username,u.role,u.name,u.owner_demo FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=$1 AND s.expires_at > now() AND u.is_active`,digest(raw)) ?? null;
  }
  app.get('/api/session',async(req,res)=>res.json({user:await current(req),demo:cfg.demo,device_id:cfg.device}));
  app.post('/api/auth/logout',async(req,res)=>{await dropSession(req,res);res.sendStatus(204);});

  const credentials=z.object({username:usernameField,password:z.string().min(1).max(128)});
  app.post('/api/auth/signup',async(req,res)=>{
    const {username,name,password,class_name,division}=credentials.extend({class_name:z.string().trim().min(1).max(50),division:z.string().trim().min(1).max(80),name:z.string().trim().min(2).max(120),password:z.string().min(8).max(128)}).parse(req.body);
    if(username===cfg.demoUsername || username===cfg.adminUsername) throw fail(409,'Username sudah digunakan.');
    const recovery=token();
    const hash=await passwordHash(password);
    await db.transaction(async tx=>{
      const account=await first(tx,`INSERT INTO users(username,name,password_hash,recovery_hash,role,is_active) VALUES ($1,$2,$3,$4,'viewer',false)
        ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash,recovery_hash=excluded.recovery_hash,name=excluded.name,is_active=false,role='viewer'
        WHERE users.password_hash IS NULL AND users.role='viewer' AND users.is_active AND NOT users.owner_demo RETURNING id`,username,name,hash,digest(recovery));
      if(!account) throw fail(409,'Username sudah terdaftar. Gunakan formulir masuk atau hubungi admin.');
      await rows(tx,'INSERT INTO members(user_id,full_name,class_name,division,is_active) VALUES($1,$2,$3,$4,false)',account.id,name,class_name,division);
    });
    res.status(201).json({recovery});
  });
  app.post('/api/auth/reset',async(req,res)=>{
    const {username,password,code}=credentials.extend({password:z.string().min(8).max(128),code:z.string().trim().min(1).max(100)}).parse(req.body);
    const recovery=token();
    const hash=await passwordHash(password);
    await db.transaction(async tx=>{
      const user=await first(tx,`UPDATE users SET password_hash=$3,recovery_hash=$4,recovery_expires=NULL
        WHERE username=$1 AND recovery_hash=$2 AND NOT owner_demo AND (recovery_expires IS NULL OR recovery_expires>now()) RETURNING id`,
        username,digest(code),hash,digest(recovery));
      if(!user) throw fail(400,'Username atau kode pemulihan tidak cocok atau sudah kedaluwarsa.');
      await rows(tx,'DELETE FROM sessions WHERE user_id=$1',user.id);
    });
    res.json({recovery});
  });
  app.post('/api/auth/signin',async(req,res)=>{
    const {username,password}=credentials.parse(req.body);
    const user=await first(db,'SELECT id,is_active,password_hash FROM users WHERE username=$1 AND NOT owner_demo',username);
    const [salt,expected]=(user?.password_hash || 'unknown:'+ '0'.repeat(128)).split(':');
    const actual=await derive(password,salt,64);
    if(!timingSafeEqual(actual,Buffer.from(expected,'hex')) || !user?.password_hash) throw fail(401,'Username atau kata sandi salah.');
    if(!user.is_active) throw fail(403,'Akses belum aktif. Hubungi admin ELITE untuk mengaktifkan akun.');
    await openSession(req,res,user.id);
    res.json({ok:true});
  });
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
