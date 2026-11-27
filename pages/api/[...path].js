export const config={api:{bodyParser:false,externalResolver:true}};
let instance;
export default async function handler(req,res){
  const demo=process.env.ELITE_DEMO==='1' && !process.env.VERCEL;
  res.setHeader('Cache-Control','no-store');
  if(req.method==='GET' && req.query.path?.join('/')==='session' && !req.cookies.elite_session){
    return res.status(200).json({user:null,demo});
  }
  try {
    instance ??= import('../../server/index.js').then(({createApp})=>createApp(process.env,demo)).catch(error=>{instance=undefined;throw error});
    const {app}=await instance;
    return app(req,res);
  } catch(error) {
    console.error('ELITE initialization failure',error.code || error.name);
    return res.status(503).json({error:'Layanan anggota sementara belum tersedia. Silakan coba lagi nanti.'});
  }
}
