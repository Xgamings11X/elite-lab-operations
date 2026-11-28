import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import multer from 'multer';
import sharp from 'sharp';
import { z } from 'zod';
import { admin,fail,token,digest,passwordHash,usernameField } from './auth.js';
import { first,rows,localDate,weekday } from './db.js';
import { recordAdminChange } from './operations.js';

const date=z.iso.date();
const division=z.string().trim().min(1).max(80);
const role=z.enum(['admin','viewer']);
const kind=z.enum(['piket','dokumentasi']);
const id=z.coerce.number().int().min(1).max(2147483647);
const time=z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const upload=multer({limits:{fileSize:5*1024*1024,fields:4,files:1,fieldSize:2048}});
const memberFields=z.object({full_name:z.string().trim().min(2).max(120),class_name:z.string().trim().min(1).max(50),division});
const attendanceQuery=`SELECT a.id,a.member_id,a.date::text,a.check_in_time,a.check_out_time,a.method,a.status,a.notes,
  m.full_name,m.class_name,m.division FROM attendances a JOIN members m ON m.id=a.member_id WHERE a.date=$1 ORDER BY lower(m.division),lower(m.class_name),lower(m.full_name),m.id`;
const picketQuery=`SELECT p.id,m.id AS member_id,m.full_name,m.class_name,m.division FROM picket_schedules p
  JOIN members m ON m.id=p.member_id WHERE p.day_of_week BETWEEN 1 AND 5 AND p.day_of_week=$1 AND m.is_active ORDER BY lower(m.division),lower(m.class_name),lower(m.full_name),m.id`;
const reportQuery=`SELECT id,kind,date::text,division,caption,verification_status,verification_note,verified_by_username,verified_at,submitted_by_username,uploader_name,participants,created_at,
  '/api/reports/' || id || '/photo' AS photo_url FROM reports`;

async function encodePhoto(file){
    try {
      const source=sharp(file.buffer,{limitInputPixels:32_000_000});
      const {format,pages}=await source.metadata();
      if(!['jpeg','png','webp','heif'].includes(format)||pages>1) throw Error();
      return await source.rotate().resize(1600,1600,{fit:'inside',withoutEnlargement:true}).webp({quality:78}).toBuffer();
    } catch { throw fail(415,'Gunakan foto JPEG, PNG, HEIC, atau WebP yang dapat dibuka.'); }
}

export function registerRoutes(app,db,cfg) {
  app.get('/api/overview',async(req,res)=>{
    const today=localDate().date;
    const [summary,device,picket,reports]=await Promise.all([
      first(db,`SELECT (SELECT count(*)::int FROM members WHERE is_active) AS members,
        (SELECT count(*)::int FROM attendances a JOIN members m ON m.id=a.member_id WHERE a.date=$1 AND a.status='present' AND m.is_active) AS present,
        (SELECT count(*)::int FROM reports WHERE verification_status='pending') AS pending,
        (SELECT count(*)::int FROM members WHERE is_active AND fingerprint_id IS NULL) AS unenrolled`,today),
      first(db,`SELECT id,last_seen,(SELECT count(*)::int FROM scan_events WHERE device_id=devices.id) AS scans,(SELECT max(created_at) FROM scan_events WHERE device_id=devices.id) AS last_scan,(SELECT response->>'status' FROM scan_events WHERE device_id=devices.id ORDER BY created_at DESC LIMIT 1) AS delivery_status,(last_seen IS NOT NULL AND last_seen>now()-interval '90 seconds') AS online FROM devices WHERE id=$1`,cfg.device),
      rows(db,picketQuery,weekday(today)),
      rows(db,reportQuery+' ORDER BY date DESC,id DESC LIMIT 3'),
    ]);
    if(req.user.role==='viewer') { delete summary.pending; delete summary.unenrolled; }
    res.json({today,summary,device:req.user.role==='admin'?device:null,picket,reports});
  });
  app.get('/api/attendance',async(req,res)=>{
    const day=date.parse(req.query.date??localDate().date);
    if(req.query.roster!=='true'||weekday(day)!==6) return res.json(await rows(db,attendanceQuery,day));
    res.json(await rows(db,`SELECT a.id,m.id AS member_id,$1::date::text AS date,
      a.check_in_time,a.check_out_time,a.method,a.notes,coalesce(a.status,'unmarked') AS status,
      m.full_name,m.class_name,m.division FROM members m
      LEFT JOIN attendances a ON a.member_id=m.id AND a.date=$1
      WHERE m.is_active OR a.id IS NOT NULL ORDER BY lower(m.division),lower(m.class_name),lower(m.full_name),m.id`,day));
  });
  app.put('/api/attendance',admin,async(req,res)=>{
    const item=z.object({member_id:id,date,status:z.enum(['present','absent','excused','competition']),check_in_time:time.nullable(),check_out_time:time.nullable(),notes:z.string().trim().max(400)}).parse(req.body);
    if (weekday(item.date)!==6) throw fail(400,'Absensi ekskul hanya untuk hari Sabtu.');
    if ((item.status==='present' && !item.check_in_time) || (item.status!=='present' && (item.check_in_time||item.check_out_time)) || (item.check_out_time && item.check_out_time<item.check_in_time)) throw fail(400,'Periksa jam masuk dan pulang.');
    await db.transaction(async tx=>{
      const member=await first(tx,'SELECT full_name FROM members WHERE id=$1 AND is_active FOR UPDATE',item.member_id);
      if (!member) throw fail(404,'Anggota aktif tidak ditemukan.');
      const saved=await first(tx,`INSERT INTO attendances(member_id,date,status,check_in_time,check_out_time,notes,method)
        VALUES ($1,$2,$3,$4,$5,$6,'manual') ON CONFLICT (member_id,date) DO UPDATE SET status=excluded.status,
        check_in_time=excluded.check_in_time,check_out_time=excluded.check_out_time,notes=excluded.notes,last_scan_at=NULL RETURNING id`,
        item.member_id,item.date,item.status,item.check_in_time,item.check_out_time,item.notes);
      await recordAdminChange(tx,req.user,'attendance_saved',saved.id,member.full_name+' · '+item.date+' · '+({present:'Hadir',absent:'Tidak hadir',excused:'Izin',competition:'Dispensasi'}[item.status]));
    });
    res.json({ok:true});
  });
  app.get('/api/picket',async(req,res)=>res.json(await rows(db,picketQuery,z.coerce.number().int().min(1).max(5).parse(req.query.day))));
  app.post('/api/picket',admin,async(req,res)=>{
    const item=z.object({day:z.number().int().min(1).max(5),member_id:id}).parse(req.body);
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
    const view=z.enum(['group','before','after']).parse(req.query.view??'group');
    const column={before:'before_photo',after:'after_photo',group:'photo_data'}[view];
    const report=await first(db,'SELECT kind,photo_key,demo_asset,'+column+' AS photo_data FROM reports WHERE id=$1',id.parse(req.params.id));
    if(!report) throw fail(404,'Foto tidak ditemukan.');
    if(report.photo_data) return res.type('image/webp').send(Buffer.from(report.photo_data));
    if(view!=='group') throw fail(404,'Foto tidak ditemukan.');
    const path=report.demo_asset ? join(cfg.root,'server','demo-assets',report.photo_key+'.webp') : join(cfg.storage,report.kind,report.photo_key);
    res.set('Content-Type','image/webp');
    res.sendFile(path,{cacheControl:false},error=>{if(error) next(error);});
  });
  app.get('/api/picket-attendance',async(req,res)=>{
    const day=date.parse(req.query.date);
    if(weekday(day)<1||weekday(day)>5)throw fail(400,'Pilih hari kerja.');
    let roster=await rows(db,'SELECT * FROM picket_attendance WHERE date=$1 ORDER BY lower(division),lower(class_name),lower(full_name),member_id',day);
    if(!roster.length) roster=await rows(db,picketQuery,weekday(day));
    const photos=await rows(db,reportQuery+" WHERE kind='piket' AND date=$1 ORDER BY id DESC",day);
    res.json({roster,photos});
  });
  const evidence=multer({limits:{files:3,fileSize:4_000_000,fields:2,fieldSize:2048}});
  app.post('/api/picket-reports',evidence.fields(['before','after','group'].map(name=>({name,maxCount:1}))),async(req,res)=>{
    const day=date.parse(req.body.date);
    const present=z.array(id).min(1).max(300).parse(String(req.body.present_ids??'').split(','));
    if(![1,2,3,4,5].includes(weekday(day))) throw fail(400,'Piket berlangsung Senin sampai Jumat.');
    const files=['before','after','group'].map(name=>req.files?.[name]?.[0]);
    if(files.some(file=>!file)) throw fail(400,'Lengkapi ketiga foto piket.');
    const [before,after,group]=await Promise.all(files.map(encodePhoto));
    const result=await db.transaction(async tx=>{
      const captured=await rows(tx,'SELECT * FROM picket_attendance WHERE date=$1 ORDER BY lower(division),lower(class_name),lower(full_name),member_id',day);
      const snapshot=captured.length?captured:await rows(tx,picketQuery,weekday(day));
      if(present.some(id=>!snapshot.some(m=>m.member_id===id)))throw fail(400,'Pilih petugas terjadwal.');
      const participants=snapshot.filter(m=>present.includes(m.member_id)).map(m=>m.full_name).join(', ');
      const report=await first(tx,`INSERT INTO reports(kind,date,caption,photo_key,submitted_by_username,uploader_name,
        participants,picket_snapshot,before_photo,after_photo,photo_data) VALUES ('piket',$1,'Bukti piket',$2,$3,$4,$5,$6::jsonb,$7,$8,$9) RETURNING id`,
        day,randomUUID()+'.webp',req.user.username,req.user.name,participants,JSON.stringify(snapshot),before,after,group);
      for(const m of snapshot){
        await rows(tx,`INSERT INTO picket_attendance(date,member_id,full_name,class_name,division,status,report_id) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(date,member_id) DO UPDATE SET status=excluded.status,report_id=excluded.report_id,recorded_at=now() WHERE picket_attendance.status='absent' AND excluded.status='present'`,day,m.member_id,m.full_name,m.class_name,m.division,present.includes(m.member_id)?'present':'absent',report.id);
      }
      return report;
    });
    res.status(201).json(result);
  });
  app.post('/api/reports',admin,upload.single('photo'),async(req,res)=>{
    const item=z.object({kind,date,division:division.optional(),caption:z.string().trim().min(3).max(500)}).parse(req.body);
    if (item.kind==='piket' && ![1,2,3,4,5].includes(weekday(item.date))) throw fail(400,'Piket berlangsung Senin sampai Jumat.');
    if (!req.file || (item.kind==='dokumentasi' && !item.division)) throw fail(400,'Pilih foto dan jurusan yang sesuai.');
    const output=await encodePhoto(req.file);
    const key=randomUUID()+'.webp';
    const result=await db.transaction(async tx=>{
        const snapshot=item.kind==='piket'?JSON.stringify(await rows(tx,picketQuery,weekday(item.date))):null;
        return first(tx,`INSERT INTO reports(kind,date,division,caption,photo_key,submitted_by_username,picket_snapshot,photo_data)
          VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8) RETURNING id`,item.kind,item.date,item.division??null,item.caption,key,req.user.username,snapshot,output);
      });
    res.status(201).json(result);
  });
  app.get('/api/admin/reports/:id/context',admin,async(req,res)=>{
    const report=await first(db,reportQuery+' WHERE id=$1',id.parse(req.params.id));
    if(!report) throw fail(404,'Laporan tidak ditemukan.');
    const [attendance,snapshot]=await Promise.all([report.kind==='piket'?rows(db,'SELECT full_name,class_name,division,member_id,status FROM picket_attendance WHERE date=$1 ORDER BY lower(division),lower(class_name),lower(full_name),member_id',report.date):rows(db,attendanceQuery,report.date),first(db,'SELECT picket_snapshot FROM reports WHERE id=$1',report.id)]);
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
      const result=await first(tx,`UPDATE reports SET verification_status=$2,verification_note=$3,verified_by_username=$4,verified_at=now()
        WHERE id=$1 AND verification_status='pending' RETURNING caption`,reportId,item.status,item.note,req.user.username);
      if(!result) throw fail(409,'Laporan sudah diperiksa atau tidak ditemukan.');
      await recordAdminChange(tx,req.user,item.status==='approved'?'report_approved':'report_revision',reportId,result.caption);
    });
    res.json({id:reportId});
  });
  app.get('/api/admin/members',admin,async(req,res)=>res.json(await rows(db,'SELECT m.*,u.username FROM members m LEFT JOIN users u ON u.id=m.user_id WHERE m.is_active ORDER BY lower(m.division),lower(m.class_name),lower(m.full_name),m.id')));
  app.post('/api/admin/members',admin,async(req,res)=>{
    const item=memberFields.extend({username:usernameField,password:z.string().min(8).max(128)}).parse(req.body);
    if(item.username===cfg.demoUsername||item.username===cfg.adminUsername) throw fail(409,'Username sudah digunakan.');
    const hash=await passwordHash(item.password);
    res.status(201).json(await db.transaction(async tx=>{
      const user=await first(tx,"INSERT INTO users(username,name,password_hash,role) VALUES($1,$2,$3,'viewer') RETURNING id",item.username,item.full_name,hash);
      return first(tx,'INSERT INTO members(full_name,class_name,division,user_id) VALUES($1,$2,$3,$4) RETURNING id',item.full_name,item.class_name,item.division,user.id);
    }));
  });
  app.patch('/api/admin/members/:id',admin,async(req,res)=>{
    const item=memberFields.extend({username:usernameField.optional(),password:z.string().min(8).max(128).optional()}).parse(req.body);
    if(item.username===cfg.demoUsername) throw fail(409,'Username sudah digunakan.');
    const hash=item.password?await passwordHash(item.password):null;
    await db.transaction(async tx=>{
      const member=await first(tx,'UPDATE members SET full_name=$2,class_name=$3,division=$4 WHERE id=$1 AND is_active RETURNING user_id',id.parse(req.params.id),item.full_name,item.class_name,item.division);
      if(!member) throw fail(404,'Anggota tidak ditemukan.');
      if(member.user_id){
        await rows(tx,'UPDATE users SET name=$2,username=coalesce($3,username),password_hash=coalesce($4,password_hash) WHERE id=$1',member.user_id,item.full_name,item.username??null,hash);
        if(hash)await rows(tx,'DELETE FROM sessions WHERE user_id=$1',member.user_id);
      }else if(item.username && hash){
        const user=await first(tx,"INSERT INTO users(username,name,password_hash,role) VALUES($1,$2,$3,'viewer') RETURNING id",item.username,item.full_name,hash);
        await rows(tx,'UPDATE members SET user_id=$2 WHERE id=$1',id.parse(req.params.id),user.id);
      }else if(item.username||hash)throw fail(400,'Isi username dan kata sandi untuk membuat akun.');
    });
    res.sendStatus(204);
  });
  app.delete('/api/admin/members/:id',admin,async(req,res)=>{
    await db.transaction(async tx=>{
      const member=await first(tx,'UPDATE members SET is_active=false,fingerprint_device=NULL,fingerprint_id=NULL WHERE id=$1 AND is_active RETURNING user_id',id.parse(req.params.id));
      if(!member)throw fail(404,'Anggota tidak ditemukan.');
      if(member.user_id){
        const account=await first(tx,'SELECT role FROM users WHERE id=$1 FOR UPDATE',member.user_id);
        if(account.role==='admin')throw fail(409,'Ubah peran admin sebelum menghapus anggota.');
        await rows(tx,'UPDATE users SET is_active=false WHERE id=$1',member.user_id);
        await rows(tx,'DELETE FROM sessions WHERE user_id=$1',member.user_id);
      }
    });
    res.sendStatus(204);
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
  app.post('/api/admin/users/:id/recovery',admin,async(req,res)=>{
    const recovery=token();
    const target=await first(db,"UPDATE users SET recovery_hash=$2,recovery_expires=now()+interval '15 minutes' WHERE id=$1 AND NOT owner_demo AND (role='viewer' OR id=$3) RETURNING id",id.parse(req.params.id),digest(recovery),req.user.id);
    if(!target) throw fail(403,'Pemulihan akun ini tidak tersedia.');
    res.json({recovery});
  });
  app.get('/api/admin/users',admin,async(req,res)=>res.json(await rows(db,'SELECT id,username,name,role,is_active,(password_hash IS NOT NULL) AS signed_in FROM users WHERE NOT owner_demo ORDER BY is_active DESC,username')));
  app.post('/api/admin/users',admin,async(req,res)=>{
    const item=z.object({username:usernameField,role}).parse(req.body);
    const result=await db.transaction(async tx=>{
      const saved=await first(tx,`UPDATE users SET is_active=true,role=$2,invited_by=$3 WHERE username=$1 AND NOT is_active AND password_hash IS NOT NULL RETURNING id`,item.username,item.role,req.user.id);
      if(!saved) throw fail(409,'Pilih akun terdaftar yang belum aktif.');
      await rows(tx,'UPDATE members SET is_active=true WHERE user_id=$1',saved.id);
      await recordAdminChange(tx,req.user,'access_granted',saved.id,item.username+' · '+(item.role==='admin'?'Admin':'Pelihat'));
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
      const changed=await first(tx,'UPDATE users SET is_active=false WHERE id=$1 AND is_active RETURNING username',target);
      if(!changed) return;
      await rows(tx,'DELETE FROM sessions WHERE user_id=$1',target);
      await recordAdminChange(tx,req.user,'access_revoked',target,changed.username);
    });
    res.sendStatus(204);
  });
}
