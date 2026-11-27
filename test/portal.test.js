import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import sharp from 'sharp';
import { createApp } from '../server/index.js';

test('Alur admin, pelihat, foto, dan sinkronisasi ESP32-C1',async t=>{
  t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-28T03:00:00Z')});
  const instance=await createApp({},true);
  const server=instance.app.listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(async()=>{
    await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
    await instance.close();
  });
  const base='http://127.0.0.1:'+server.address().port;
  async function call(path,{method='GET',body,cookie,headers={}}={}) {
    const multipart=body instanceof FormData;
    const response=await fetch(base+'/api'+path,{method,headers:{
      Origin:'http://localhost:4173',...(cookie?{Cookie:cookie}:{}),
      ...(body&&!multipart?{'Content-Type':'application/json'}:{}),...headers,
    },body:body?(multipart?body:JSON.stringify(body)):undefined});
    const result=response.headers.get('content-type')?.includes('json')?await response.json():await response.arrayBuffer();
    return {status:response.status,result,cookie:response.headers.getSetCookie().find(value=>value.startsWith('elite_session=')&&!value.startsWith('elite_session=;'))?.split(';')[0]};
  }
  const login=(role)=>call('/auth/demo',{method:'POST',body:{role}});
  assert.equal((await call('/overview')).status,401);
  assert.equal((await call('/auth/demo',{method:'POST',body:{role:'admin'},headers:{Origin:'https://example.org'}})).status,403);
  const {cookie:admin}=await login('admin'),{cookie:viewer}=await login('viewer');
  const {result:{today,summary}}=await call('/overview',{cookie:admin});
  assert.equal(summary.present,18);
  assert.equal((await call('/overview',{cookie:viewer})).result.summary.pending,undefined);
  assert.equal((await call('/insights')).status,401);
  const insights=await call('/insights',{cookie:viewer});
  assert.equal(insights.status,200);
  assert.equal(insights.result.trend.length,14);
  assert.deepEqual(insights.result.trend.at(-1),{date:today,present:18,excused:2});
  assert.ok(insights.result.activity.some(item=>item.action==='activity_report'));
  for (const route of ['/admin/users','/admin/members','/reports?pending=true','/admin/reports/1/context','/admin/audit']) {
    assert.equal((await call(route,{cookie:viewer})).status,403,route);
  }
  assert.equal((await call('/attendance',{method:'PUT',cookie:viewer,body:{}})).status,403);
  assert.equal((await call('/reports/1/photo')).status,401);
  assert.equal((await call('/reports/1/photo',{cookie:viewer})).status,200);

  assert.equal((await call('/picket?day=6',{cookie:admin})).status,400);
  const friday=await call('/attendance',{cookie:admin,method:'PUT',body:{member_id:1,date:'2026-11-27',status:'absent',notes:'',check_in_time:null,check_out_time:null}});
  assert.equal(friday.status,400);
  const png=await sharp({create:{width:24,height:24,channels:3,background:'#FF3E3E'}}).png().toBuffer();
  const photo=new FormData();
  photo.set('kind','piket');
  photo.set('date','2026-11-27');
  photo.set('caption','Foto uji petugas lab');
  photo.set('photo',new Blob([png],{type:'image/png'}),'photo.png');
  assert.equal((await call('/reports',{method:'POST',cookie:viewer,body:photo})).status,403);
  const uploaded=await call('/reports',{method:'POST',cookie:admin,body:photo});
  assert.equal(uploaded.status,201);
  const reportId=uploaded.result.id;
  const stored=await call('/reports/'+reportId+'/photo',{cookie:viewer});
  assert.equal(stored.status,200);
  assert.equal(Buffer.from(stored.result).subarray(8,12).toString(),'WEBP');
  const context=await call('/admin/reports/'+reportId+'/context',{cookie:admin});
  assert.equal(context.status,200);
  assert.ok(Array.isArray(context.result.allAttendance));
  const review=(status,note)=>call('/admin/reports/'+reportId,{method:'PATCH',cookie:admin,body:{status,note}});
  assert.equal((await review('rejected','')).status,400);
  assert.equal((await review('rejected','Mohon foto lebih terang.')).status,200);
  assert.equal((await review('approved','')).status,409);
  assert.equal((await call('/reports?kind=piket',{cookie:viewer})).result[0].verification_status,'rejected');

  const member=await call('/admin/members',{method:'POST',cookie:admin,body:{full_name:'Anggota Uji',class_name:'XI TEI',division:'Elektronik'}});
  assert.equal(member.status,201);
  const memberId=member.result.id;
  assert.equal((await call('/admin/members/'+memberId+'/fingerprint',{method:'PATCH',cookie:admin,body:{fingerprint_id:99}})).status,200);
  const eventId=randomUUID();
  const scan=(options={})=>call('/iot/fingerprint-attendance',{method:'POST',body:{device_id:'ESP32-C1-LAB-01',fingerprint_id:99,event_id:eventId,...options.body},headers:options.headers??{'X-Device-Token':'demo-local-device-token'}});
  assert.equal((await scan({headers:{}})).status,401);
  const firstScan=await scan();
  assert.equal(firstScan.status,200);
  assert.equal(firstScan.result.type,'IN');
  assert.deepEqual((await scan()).result,firstScan.result);
  assert.equal((await scan({body:{event_id:randomUUID()}})).result.type,'DUPLICATE');
  assert.equal((await scan({body:{fingerprint_id:98,event_id:randomUUID()}})).status,404);
  const write=await call('/attendance',{method:'PUT',cookie:admin,body:{member_id:memberId,date:today,status:'present',check_in_time:'00:00',check_out_time:null,notes:'Uji input admin'}});
  assert.equal(write.status,200);
  assert.equal((await scan({body:{event_id:randomUUID()}})).result.type,'OUT');
  assert.equal((await scan({body:{event_id:randomUUID()}})).result.type,'UNCHANGED');

  const roster=await call('/attendance?roster=true&date='+today,{cookie:viewer});
  assert.ok(roster.result.some(row=>row.status==='unmarked'));
  const correction={member_id:memberId,date:today,status:'absent',check_in_time:null,check_out_time:null,notes:'Dikoreksi setelah pengecekan.'};
  assert.equal((await call('/attendance',{method:'PUT',cookie:viewer,body:correction})).status,403);
  assert.equal((await call('/attendance',{method:'PUT',cookie:admin,body:correction})).status,200);
  const updated=(await call('/attendance?date='+today,{cookie:viewer})).result.find(row=>row.member_id===memberId);
  assert.equal(updated.status,'absent');
  assert.equal(updated.check_in_time,null);
  assert.equal(updated.check_out_time,null);
  assert.equal((await scan({body:{event_id:randomUUID()}})).result.type,'UNCHANGED');
  const account={email:'undangan.uji@gmail.com',password:'kata-sandi-uji',name:'Anggota Uji'};
  assert.equal((await call('/auth/signup',{method:'POST',body:account})).status,201);
  assert.equal((await call('/auth/signin',{method:'POST',body:account})).status,403);
  const invited=await call('/admin/users',{method:'POST',cookie:admin,body:{email:'undangan.uji@gmail.com',role:'viewer'}});
  assert.equal(invited.status,201);
  assert.ok((await call('/auth/signin',{method:'POST',body:account})).cookie);
  assert.equal((await call('/admin/users/'+invited.result.id,{method:'DELETE',cookie:admin})).status,204);
  const users=await call('/admin/users',{cookie:admin});
  const viewerId=users.result.find(user=>user.email==='viewer@gmail.com').id;
  assert.equal((await call('/admin/users/'+viewerId,{method:'DELETE',cookie:admin})).status,204);
  assert.equal((await call('/overview',{cookie:viewer})).status,401);
  const audit=await call('/admin/audit',{cookie:admin});
  assert.equal(audit.status,200);
  assert.deepEqual(audit.result.map(event=>event.action),['access_revoked','access_revoked','access_granted','attendance_saved','attendance_saved','fingerprint_linked','report_revision']);
  assert.ok(audit.result.every(event=>event.actor_email==='admin@gmail.com'));
});
