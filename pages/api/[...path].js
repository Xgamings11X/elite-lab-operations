import {createApp} from '../../server/index.js';
export const config={api:{bodyParser:false,externalResolver:true}};
let instance;
export default async function handler(req,res){
  instance ??= createApp(process.env,process.env.ELITE_DEMO==='1'&&!process.env.VERCEL).catch(error=>{instance=undefined;throw error});
  const {app}=await instance;
  return app(req,res);
}