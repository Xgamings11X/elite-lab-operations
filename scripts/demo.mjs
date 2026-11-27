import {spawn} from 'node:child_process';
const port=process.env.PORT||'4173';
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',port],{stdio:'inherit',env:{...process.env,ELITE_DEMO:'1',APP_URL:'http://127.0.0.1:'+port}});
child.on('exit',code=>process.exit(code??1));