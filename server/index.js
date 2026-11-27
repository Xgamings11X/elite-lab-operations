import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { join,resolve,relative,isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtemp,mkdir,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { ZodError } from 'zod';
import { authentication,fail } from './auth.js';
import { database,rows } from './db.js';
import { seedDemo } from './demo.js';
import { iot } from './iot.js';
import { registerRoutes } from './routes.js';
import { registerOperations } from './operations.js';

const root = fileURLToPath(new URL('../', import.meta.url));
export async function createApp(env=process.env,demo=false) {
  const url=new URL(env.APP_URL || 'http://localhost:4173');
  const host=env.HOST||'127.0.0.1';
  const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if (url.protocol!=='https:' && !(url.protocol==='http:' && loopback)) throw Error('APP_URL harus HTTPS di luar loopback.');
  if (demo && (host!=='127.0.0.1'||!loopback)) throw Error('Demo hanya untuk loopback.');
  if (!demo && (!env.DATABASE_URL || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.BOOTSTRAP_ADMIN_EMAIL?.match(/^[a-z0-9._+%-]+@gmail\.com$/i) || (env.DEVICE_TOKEN?.length??0)<32)) throw Error('Lengkapi DATABASE_URL, kredensial Google, Gmail admin dan token perangkat (min. 32 karakter).');
  const cfg={demo,url,host,port:Number(env.PORT||url.port||4173),device:env.DEVICE_ID||'ESP32-C1-LAB-01',
    googleId:env.GOOGLE_CLIENT_ID,googleSecret:env.GOOGLE_CLIENT_SECRET,deviceToken:demo?'demo-local-device-token':env.DEVICE_TOKEN,
    storage: demo?await mkdtemp(join(tmpdir(),'elite-demo-')):resolve(env.STORAGE_DIR||join(root,'storage')),root};
  const storageFromDist=relative(join(root,'dist'),cfg.storage);
  if (!demo && !isAbsolute(storageFromDist) && !/^\.\.(?:[\\/]|$)/.test(storageFromDist)) throw Error('Lokasi foto harus di luar folder dist.');
  if (!/^[a-zA-Z0-9._-]{1,80}$/.test(cfg.device)) throw Error('Format DEVICE_ID tidak sah.');
  const db=await database(demo?null:env.DATABASE_URL);
  await mkdir(cfg.storage,{recursive:true});
  await rows(db,'INSERT INTO devices(id) VALUES ($1) ON CONFLICT DO NOTHING',cfg.device);
  let demoUsers;
  if (demo) demoUsers=await seedDemo(db,cfg.device);
  else await rows(db,"INSERT INTO users(email,role) SELECT $1,'admin' WHERE NOT EXISTS(SELECT 1 FROM users) ON CONFLICT DO NOTHING",env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase());
  const app=express();
  app.disable('x-powered-by');
  app.set('trust proxy',Number(env.TRUST_PROXY_HOPS||0));
  app.use(helmet({strictTransportSecurity:loopback?false:undefined,contentSecurityPolicy:{directives:{'upgrade-insecure-requests':loopback?null:[], 'style-src':["'self'","'unsafe-inline'"], 'img-src':["'self'",'data:','blob:']}}}));
  app.use('/api',(req,res,next)=>{
    res.set('Cache-Control','no-store');
    if (!['GET','HEAD','OPTIONS'].includes(req.method) && !req.path.startsWith('/iot/')) {
      const allowed=[url.origin];
      if (loopback) allowed.push('http://localhost:5173','http://127.0.0.1:5173','http://127.0.0.1:'+cfg.port);
      if (!allowed.includes(req.get('Origin'))) return next(fail(403,'Asal permintaan tidak diizinkan.'));
    }
    next();
  });
  app.use('/api/auth',rateLimit({windowMs:60000,limit:30,message:{error:'Terlalu banyak percobaan login.'}}));
  app.use('/api/iot',rateLimit({windowMs:60000,limit:180,message:{error:'Terlalu banyak permintaan perangkat.'}}));
  app.use(express.json({limit:'32kb'}));
  iot(app,db,cfg);
  const signedIn=authentication(app,db,cfg,demoUsers);
  app.use('/api',signedIn);
  registerRoutes(app,db,cfg);
  registerOperations(app,db);
  app.use('/api',(req,res)=>res.status(404).json({error:'Endpoint tidak ditemukan.'}));
  app.use(express.static(join(root,'dist'),{
    index:'index.html',maxAge:'1h',
    setHeaders(res,path) {
      if(path.endsWith('.html')||path.endsWith('favicon.svg')) res.setHeader('Cache-Control','no-cache');
    },
  }));
  app.use((err,req,res,next)=>{
    if (res.headersSent) return next(err);
    if (err instanceof ZodError) return res.status(400).json({error:'Periksa isian.',details:err.issues.map(i=>i.path.join('.'))});
    if (err.code==='23505') return res.status(409).json({error:'Data sudah digunakan.'});
    if (err.code==='LIMIT_FILE_SIZE') return res.status(413).json({error:'Ukuran foto maksimal 5 MB.'});
    const status=err.status || (err.name==='MulterError'?400:500);
    if (status>=500) console.error('API error',err.code||err.name);
    res.status(status).json({error:status>=500?'Terjadi gangguan pada server.':err.message});
  });
  return {app,cfg,close:async()=>{await db.close();if(demo) await rm(cfg.storage,{recursive:true,force:true});}};
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const {app,cfg,close}=await createApp(process.env,process.argv.includes('--demo'));
  const server=app.listen(cfg.port,cfg.host,()=>console.log('ELITE '+(cfg.demo?'demo':'portal')+' http://'+cfg.host+':'+cfg.port));
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(async()=>{await close();process.exit(0);}));
}
