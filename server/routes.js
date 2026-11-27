import { randomUUID } from 'node:crypto';
import { mkdir,writeFile,unlink } from 'node:fs/promises';
import { join } from 'node:path';
import multer from 'multer';
import sharp from 'sharp';
import { z } from 'zod';
import { admin,fail } from './auth.js';
import { first,rows,localDate,weekday } from './db.js';
import { recordAdminChange } from './operations.js';

const mail=z.string().trim().toLowerCase().pipe(z.email().regex(/@gmail\.com$/).max(254));
const date=z.iso.date();
const division=z.enum(['Programming','Elektronik','Mekanik']);
const role=z.enum(['admin','viewer']);
const kind=z.enum(['piket','dokumentasi']);
const id=z.coerce.number().int().min(1).max(2147483647);
const time=z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const upload=multer({limits:{fileSize:5*1024*1024,fields:4,files:1,fieldSize:2048}});
const memberFields=z.object({full_name:z.string().trim().min(2).max(120),class_name:z.string().trim().min(1).max(50),division});
const attendanceQuery=`SELECT a.id,a.member_id,a.date::text,a.check_in_time,a.check_out_time,a.method,a.status,a.notes,
  m.full_name,m.class_name,m.division FROM attendances a JOIN members m ON m.id=a.member_id WHERE a.date=$1 ORDER BY a.check_in_time NULLS LAST,m.full_name`;
const picketQuery=`SELECT p.id,m.id AS member_id,m.full_name,m.class_name,m.division FROM picket_schedules p
  JOIN members m ON m.id=p.member_id WHERE p.day_of_week=$1 AND m.is_active ORDER BY m.full_name`;
const reportQuery=`SELECT id,kind,date::text,division,caption,verification_status,verification_note,verified_by_email,verified_at,submitted_by_email,created_at,
  '/api/reports/' || id || '/photo' AS photo_url FROM reports`;

export function registerRoutes(app,db,cfg) {
  app.get('/api/overview',async(req,res)=>{
    const today=localDate().date;
    const [summary,device,picket,reports]=await Promise.all([
      first(db,`SELECT (SELECT count(*)::int FROM members WHERE is_active) AS members,
        (SELECT count(*)::int FROM attendances a JOIN members m ON m.id=a.member_id WHERE a.date=$1 AND a.status='present' AND m.is_active) AS present,
        (SELECT count(*)::int FROM reports WHERE verification_status='pending') AS pending,
        (SELECT count(*)::int FROM members WHERE is_active AND fingerprint_id IS NULL) AS unenrolled`,today),
      first(db,`SELECT id,last_seen,(last_seen IS NOT NULL AND last_seen>now()-interval '90 seconds') AS online FROM devices WHERE id=$1`,cfg.device),
      rows(db,picketQuery,weekday(today)),
      rows(db,reportQuery+' ORDER BY date DESC,id DESC LIMIT 3'),
    ]);
    if(req.user.role==='viewer') { delete summary.pending; delete summary.unenrolled; }
    res.json({today,summary,device,picket,reports});
  });
  app.get('/api/attendance',async(req,res)=>res.json(await rows(db,attendanceQuery,date.parse(req.query.date??localDate().date))));
  app.put('/api/attendance',admin,async(req,res)=>{
    const item=z.object({member_id:id,date,status:z.enum(['present','excused','competition']),check_in_time:time.nullable(),check_out_time:time.nullable(),notes:z.string().trim().max(400)}).parse(req.body);
    if ((item.status==='present' && !item.check_in_time) || (item.status!=='present' && (item.check_in_time||item.check_out_time)) || (item.check_out_time && item.check_out_time<item.check_in_time)) throw fail(400,'Periksa jam masuk dan pulang.');
    await db.transaction(async tx=>{
      const member=await first(tx,'SELECT full_name FROM members WHERE id=$1 AND is_active FOR UPDATE',item.member_id);
      if (!member) throw fail(404,'Anggota aktif tidak ditemukan.');
      const saved=await first(tx,`INSERT INTO attendances(member_id,date,status,check_in_time,check_out_time,notes,method)
        VALUES ($1,$2,$3,$4,$5,$6,'manual') ON CONFLICT (member_id,date) DO UPDATE SET status=excluded.status,
        check_in_time=excluded.check_in_time,check_out_time=excluded.check_out_time,notes=excluded.notes,method='manual',last_scan_at=NULL RETURNING id`,
        item.member_id,item.date,item.status,item.check_in_time,item.check_out_time,item.notes);
      await recordAdminChange(tx,req.user,'attendance_saved',saved.id,member.full_name+' · '+item.date);
    });
    res.json({ok:true});
  });
  app.get('/api/picket',async(req,res)=>res.json(await rows(db,picketQuery,z.coerce.number().int().min(1).max(6).parse(req.query.day))));
  app.post('/api/picket',admin,async(req,res)=>{
    const item=z.object({day:z.number().int().min(1).max(6),member_id:id}).parse(req.body);
    const result=await first(db,`INSERT INTO picket_schedules(day_of_week,member_id)
      SELECT $1,id FROM members WHERE id=$2 AND is_active ON CONFLICT DO NOTHING RETURNING id`,item.day,item.member_id);
    if (!result) throw fail(409,'Anggota sudah dijadwalkan atau tidak aktif.');
    res.status(201).json(result);
  });
  app.delete('/api/picket/:id',admin,async(req,res)=>{
    await rows(db,'DELETE FROM picket_schedules WHERE id=$1',id.parse(req.params.id));
    res.sendStatus(204);
  });
  app.get('/api/reports',async(req,res)=>{
    const query=z.object({kind:kind.optional(),pending:z.enum(['true']).optional(),before:id.optional()}).parse(req.query);
    if(query.pending && req.user.role!=='admin') throw fail(403,'Antrean khusus admin.');
    res.json(await rows(db,reportQuery+` WHERE ($1::text IS NULL OR kind=$1)
      AND ($2::boolean = false OR verification_status='pending') AND ($3::integer IS NULL OR id<$3)
      ORDER BY id DESC LIMIT 24`,query.kind??null,Boolean(query.pending),query.before??null));
  });
  app.get('/api/reports/:id/photo',async(req,res,next)=>{
    const report=await first(db,'SELECT kind,photo_key,demo_asset FROM reports WHERE id=$1',id.parse(req.params.id));
    if(!report) throw fail(404,'Foto tidak ditemukan.');
    const path=report.demo_asset ? join(cfg.root,'server','demo-assets',report.photo_key+'.webp') : join(cfg.storage,report.kind,report.photo_key);
    res.set('Content-Type','image/webp');
    res.sendFile(path,{cacheControl:false},error=>{if(error) next(error);});
  });
  app.post('/api/reports',admin,upload.single('photo'),async(req,res)=>{
    const item=z.object({kind,date,division:division.optional(),caption:z.string().trim().min(3).max(500)}).parse(req.body);
    if (!req.file || (item.kind==='dokumentasi' && !item.division)) throw fail(400,'Pilih foto dan divisi yang sesuai.');
    let output;
    try {
      const source=sharp(req.file.buffer,{limitInputPixels:32_000_000});
      const {format,pages}=await source.metadata();
      if(!['jpeg','png','webp','heif'].includes(format)||pages>1) throw Error();
      output=await source.rotate().resize(1600,1600,{fit:'inside',withoutEnlargement:true}).webp({quality:78}).toBuffer();
    } catch { throw fail(415,'Gunakan foto JPEG, PNG, HEIC, atau WebP yang dapat dibuka.'); }
    const key=randomUUID()+'.webp';
    const directory=join(cfg.storage,item.kind);
    await mkdir(directory,{recursive:true});
    const path=join(directory,key);
    await writeFile(path,output,{flag:'wx'});
    let result;
    try {
      result=await db.transaction(async tx=>{
        const snapshot=item.kind==='piket'?JSON.stringify(await rows(tx,picketQuery,weekday(item.date))):null;
        return first(tx,`INSERT INTO reports(kind,date,division,caption,photo_key,submitted_by_email,picket_snapshot)
          VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id`,item.kind,item.date,item.division??null,item.caption,key,req.user.email,snapshot);
      });
    } catch (error) { await unlink(path).catch(()=>{}); throw error; }
    res.status(201).json(result);
  });
  app.get('/api/admin/reports/:id/context',admin,async(req,res)=>{
    const report=await first(db,reportQuery+' WHERE id=$1',id.parse(req.params.id));
    if(!report) throw fail(404,'Laporan tidak ditemukan.');
    const [attendance,snapshot]=await Promise.all([rows(db,attendanceQuery,report.date),first(db,'SELECT picket_snapshot FROM reports WHERE id=$1',report.id)]);
    const picket=snapshot?.picket_snapshot??await rows(db,picketQuery,weekday(report.date));
    const planned = new Set(picket.map(item=>item.member_id));
    const comparison=report.kind==='piket'?attendance.filter(item=>planned.has(item.member_id)):attendance.filter(item=>item.division===report.division);
    res.json({report,attendance:comparison,allAttendance:attendance,picket});
  });
  app.patch('/api/admin/reports/:id',admin,async(req,res)=>{
    const item=z.object({status:z.enum(['approved','rejected']),note:z.string().trim().max(500)}).parse(req.body);
    if(item.status==='rejected' && !item.note) throw fail(400,'Isi catatan revisi.');
    const reportId=id.parse(req.params.id);
    await db.transaction(async tx=>{
      const result=await first(tx,`UPDATE reports SET verification_status=$2,verification_note=$3,verified_by_email=$4,verified_at=now()
        WHERE id=$1 AND verification_status='pending' RETURNING caption`,reportId,item.status,item.note,req.user.email);
      if(!result) throw fail(409,'Laporan sudah diperiksa atau tidak ditemukan.');
      await recordAdminChange(tx,req.user,item.status==='approved'?'report_approved':'report_revision',reportId,result.caption);
    });
    res.json({id:reportId});
  });
  app.get('/api/admin/members',admin,async(req,res)=>res.json(await rows(db,'SELECT * FROM members ORDER BY full_name')));
  app.post('/api/admin/members',admin,async(req,res)=>{
    const item=memberFields.parse(req.body);
    res.status(201).json(await first(db,'INSERT INTO members(full_name,class_name,division) VALUES($1,$2,$3) RETURNING id',item.full_name,item.class_name,item.division));
  });
  app.patch('/api/admin/members/:id/fingerprint',admin,async(req,res)=>{
    const item=z.object({fingerprint_id:z.number().int().min(1).max(65535).nullable()}).parse(req.body);
    const memberId=id.parse(req.params.id);
    await db.transaction(async tx=>{
      const result=await first(tx,'UPDATE members SET fingerprint_id=$2,fingerprint_device=$3 WHERE id=$1 AND is_active RETURNING full_name',memberId,item.fingerprint_id,item.fingerprint_id?cfg.device:null);
      if(!result) throw fail(404,'Anggota aktif tidak ditemukan.');
      await recordAdminChange(tx,req.user,item.fingerprint_id?'fingerprint_linked':'fingerprint_unlinked',memberId,result.full_name);
    });
    res.json({id:memberId});
  });
  app.get('/api/admin/users',admin,async(req,res)=>res.json(await rows(db,'SELECT id,email,name,role,is_active,(google_sub IS NOT NULL) AS signed_in FROM users ORDER BY is_active DESC,email')));
  app.post('/api/admin/users',admin,async(req,res)=>{
    const item=z.object({email:mail,role}).parse(req.body);
    const result=await db.transaction(async tx=>{
      const saved=await first(tx,`INSERT INTO users(email,role,invited_by) VALUES($1,$2,$3)
        ON CONFLICT(email) DO UPDATE SET is_active=true,role=excluded.role,invited_by=excluded.invited_by WHERE NOT users.is_active RETURNING id`,item.email,item.role,req.user.id);
      if(!saved) throw fail(409,'Akses Gmail ini sudah aktif.');
      await recordAdminChange(tx,req.user,'access_granted',saved.id,item.email+' · '+(item.role==='admin'?'Admin':'Pelihat'));
      return saved;
    });
    res.status(201).json(result);
  });
  app.delete('/api/admin/users/:id',admin,async(req,res)=>{
    const target=id.parse(req.params.id);
    if (target===req.user.id) throw fail(409,'Akses akun sendiri tidak dapat dicabut.');
    await db.transaction(async tx=>{
      const admins=await rows(tx,"SELECT id FROM users WHERE is_active AND role='admin' ORDER BY id FOR UPDATE");
      if(!admins.some(user=>user.id===req.user.id)) throw fail(403,'Akses admin sudah dicabut.');
      const changed=await first(tx,'UPDATE users SET is_active=false WHERE id=$1 AND is_active RETURNING email',target);
      if(!changed) return;
      await rows(tx,'DELETE FROM sessions WHERE user_id=$1',target);
      await recordAdminChange(tx,req.user,'access_revoked',target,changed.email);
    });
    res.sendStatus(204);
  });
}
