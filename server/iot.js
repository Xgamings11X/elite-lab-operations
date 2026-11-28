import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { first,rows,localDate,weekday } from './db.js';
import { fail,digest } from './auth.js';

export function iot(app,db,cfg) {
  const shape=z.object({device_id:z.literal(cfg.device)});
  function authorize(req,res,next) {
    const supplied=req.get('X-Device-Token')??'';
    if (!cfg.deviceToken || !timingSafeEqual(Buffer.from(digest(supplied)),Buffer.from(digest(cfg.deviceToken)))) throw fail(401,'Token perangkat tidak sah.');
    next();
  }
  app.post('/api/iot/heartbeat',authorize,async(req,res)=>{
    shape.parse(req.body);
    await rows(db,'UPDATE devices SET last_seen=now() WHERE id=$1',cfg.device);
    res.json({status:'success'});
  });
  app.post('/api/iot/fingerprint-attendance',authorize,async(req,res)=>{
    const scan=shape.extend({fingerprint_id:z.number().int().min(1).max(65535),event_id:z.uuid()}).parse(req.body);
    const result=await db.transaction(async tx=>{
      await rows(tx,'UPDATE devices SET last_seen=now() WHERE id=$1',cfg.device);
      const stored=await first(tx,'SELECT fingerprint_id,response FROM scan_events WHERE device_id=$1 AND event_id=$2',cfg.device,scan.event_id);
      if (stored) {
        if (stored.fingerprint_id!==scan.fingerprint_id) throw fail(409,'ID transaksi sudah dipakai.');
        return stored.response;
      }
      const member=await first(tx,'SELECT id,full_name FROM members WHERE is_active AND fingerprint_device=$1 AND fingerprint_id=$2 FOR UPDATE',cfg.device,scan.fingerprint_id);
      if (!member) return {status:'unknown',message:'ID sidik jari belum ditautkan.'};
      const { date,time,now }=localDate();
      if(weekday(date)!==6) throw fail(400,'Absensi ekskul hanya dibuka hari Sabtu WIB.');
      const attendance=await first(tx,'SELECT status,check_in_time,check_out_time,last_scan_at FROM attendances WHERE member_id=$1 AND date=$2 FOR UPDATE',member.id,date);
      let type='IN';
      if (!attendance) {
        await rows(tx,`INSERT INTO attendances(member_id,date,check_in_time,status,method,last_scan_at)
          VALUES ($1,$2,$3,'present','esp32_c3_fingerprint',$4)`,member.id,date,time,now.toISOString());
      } else if (attendance.status!=='present' || attendance.check_out_time) type='UNCHANGED';
      else if (attendance.last_scan_at && now-new Date(attendance.last_scan_at)<90000) type='DUPLICATE';
      else if (!attendance.check_in_time) {
        await rows(tx,'UPDATE attendances SET check_in_time=$3,last_scan_at=$4 WHERE member_id=$1 AND date=$2',member.id,date,time,now.toISOString());
      } else if (time>=attendance.check_in_time) {
        type='OUT';
        await rows(tx,'UPDATE attendances SET check_out_time=$3,last_scan_at=$4 WHERE member_id=$1 AND date=$2',member.id,date,time,now.toISOString());
      } else type='UNCHANGED';
      const result={status:'success',name:member.full_name,type};
      await rows(tx,'INSERT INTO scan_events(device_id,event_id,fingerprint_id,response) VALUES ($1,$2,$3,$4)',cfg.device,scan.event_id,scan.fingerprint_id,JSON.stringify(result));
      return result;
    });
    res.status(result.status==='unknown'?404:200).json(result);
  });
}
