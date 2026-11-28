import { SESSION_MS } from './session-duration.js';
import express from 'express';
import {rateLimit} from 'express-rate-limit';
import {createHmac, createHash, randomBytes, timingSafeEqual, scryptSync} from 'node:crypto';

const hash=value=>createHash('sha256').update(value).digest();
const equal=(a,b)=>timingSafeEqual(hash(a),hash(b));
export async function createApp(env=process.env,demo=false,fixtures={}){
  const app=express();
  app.disable('x-powered-by');
  app.set('trust proxy',Number(env.TRUST_PROXY_HOPS||0));
  const origin=new URL(env.APP_URL || (env.VERCEL_PROJECT_PRODUCTION_URL?'https://'+env.VERCEL_PROJECT_PRODUCTION_URL:demo?'http://localhost:4173':'http://localhost:3000')).origin;
  const options={httpOnly:true,secure:origin.startsWith('https:'),sameSite:'lax',path:'/'};
  const username=(env.OWNER_DEMO_USERNAME||'demo').trim().toLowerCase(), password=env.OWNER_DEMO_PASSWORD;
  const key=username && password?.length>=8 && password.length<=128?scryptSync(password,'elite-demo:'+username,32):null;
  const sign=value=>createHmac('sha256',key).update(value).digest('base64url');
  function demoCookie(res,role,expires){
    const payload=['demo',expires,randomBytes(16).toString('hex'),role].join('.');
    res.cookie('elite_session',payload+'.'+sign(payload),{...options,maxAge:expires-Date.now()});
  }
  let backend;
  app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');next()});
  app.post('/api/auth/signin',express.json({limit:'32kb'}),(req,res,next)=>{
    if(!username || typeof req.body?.username!=='string' || req.body.username.trim().toLowerCase()!==username)return next('route');
    if(req.get('origin')!==origin)return res.status(403).json({error:'Asal permintaan tidak diizinkan.'});
    next();
  },rateLimit({windowMs:60000,limit:20,message:{error:'Coba kembali sebentar.'}}),(req,res)=>{
    if(!key || typeof req.body.password!=='string' || !equal(req.body.password,password))return res.status(401).json({error:'Username atau kata sandi salah.'});
    demoCookie(res,'viewer',Date.now()+SESSION_MS);
    return res.json({ok:true});
  });
  app.use('/api',(req,res,next)=>{
    const session=req.headers.cookie?.match(/(?:^|; *)elite_session=([^;]+)/)?.[1];
    const guest={user:null,demo};
    if(!session?.startsWith('demo.')){
      if(req.path.startsWith('/demo/role/'))return res.status(403).json({error:'Khusus akun demo.'});
      if(!session && req.method==='GET' && req.path==='/session') return res.json(guest);
      return next();
    }
    const parts=session.split('.');
    const mac=parts.pop(), exp=parts[1];
    // Existing three-field payloads represent a viewer session.
    const role=parts.length===3?'viewer':parts[3];
    if(!key || Number(exp)<=Date.now() || !/^\d{13}$/.test(exp) || !mac || !['viewer','admin'].includes(role) || !equal(mac,sign(parts.join('.')))){
      res.clearCookie('elite_session',options);
      return req.path==='/session'?res.json(guest):res.status(401).json({error:'Silakan masuk kembali.'});
    }
    if(req.method==='POST' && ['/demo/role/admin','/demo/role/viewer'].includes(req.path)){
      if(req.get('origin')!==origin)return res.status(403).json({error:'Asal permintaan tidak diizinkan.'});
      demoCookie(res,req.path.endsWith('/admin')?'admin':'viewer',Number(exp));
      return res.json({ok:true});
    }
    if(req.method==='POST' && req.path==='/auth/logout' && req.get('origin')===origin)return res.clearCookie('elite_session',options).sendStatus(204);
    if(req.method==='GET' && req.path==='/session')return res.json({demo:false,user:{username,name:'Demo ELITE',id:0,role,owner_demo:true}});
    const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'});
    const member={id:1,member_id:1,full_name:'Anggota Contoh',class_name:'XI',division:'Teknik Elektronika'};
    const day=new Date(today+'T12:00:00Z').getUTCDay();
    const sample={
      '/overview':{today,summary:{members:1,present:day===6?1:0},picket:day>=1&&day<=5?[member]:[],reports:[]},
      '/attendance':new Date(String(req.query.date)+'T12:00:00Z').getUTCDay()===6?[{...member,status:'present',check_in_time:'08:00',check_out_time:null}]:[],
      '/picket-attendance':{roster:[member],photos:[]},'/picket':[member],'/reports':[],'/insights':{trend:[{date:today,present:day===6?1:0,excused:0}],activity:[]}
    };

    if(role==='admin'){
      sample['/overview'].summary.pending=0;
      sample['/overview'].device={id:'Perangkat contoh',online:true,last_seen:new Date(),scans:1,last_scan:new Date()};
      sample['/admin/members']=[{...member,is_active:true}];
      sample['/admin/users']=[{id:1,username:'anggota',name:member.full_name,role:'viewer',is_active:true,signed_in:true}];
      sample['/admin/audit']=[];
    }
    if(req.method==='GET' && Object.hasOwn(sample,req.path))return res.json(sample[req.path]);
    return res.status(403).json({error:'Akun demo hanya dapat melihat data contoh.'});
  });
  app.use(async(req,res)=>{
    if(!demo && !env.DATABASE_URL?.trim() && !env.POSTGRES_URL?.trim()){
      return res.status(503).json({code:'MEMBER_DB_MISSING',error:'Database anggota belum terhubung. Hubungi pengelola ELITE.'});
    }
    try{
      backend??=import('./index.js').then(m=>m.createApp(env,demo,fixtures)).catch(e=>{backend=undefined;throw e});
      return (await backend).app(req,res);
    }catch(error){
      console.error('ELITE member service',error.code||error.name);
      res.status(503).json({error:'Layanan anggota sementara belum tersedia. Silakan coba lagi nanti.'});
    }
  });
  return {app,close:async()=>{if(backend)await (await backend).close()}};
}
