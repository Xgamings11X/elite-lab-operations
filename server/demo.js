import { first,rows,localDate,weekday } from './db.js';

export async function seedDemo(db,device) {
  const admin = await first(db,"INSERT INTO users(email,name,role) VALUES ('admin@gmail.com','Admin ELITE','admin') RETURNING id");
  const viewer = await first(db,"INSERT INTO users(email,name,role) VALUES ('viewer@gmail.com','Pelihat ELITE','viewer') RETURNING id");
  const names = ['Aditya Pratama','Nabila Rahma','Rizky Ramadhan','Siti Aulia','Fajar Maulana','Dewi Anggraini','Bagas Saputra','Rafi Hidayat','Intan Permata','Alvin Setiawan','Keisha Putri','Dimas Nugroho','Citra Amelia','Farhan Rayhan','Aisyah Khairani','Naufal Akbar','Gita Safitri','Reza Firmansyah','Kevin Putra','Alika Salsabila','Bayu Ramadan','Arya Mahendra','Lulu Maharani','Daffa Rizaldi'];
  const divisions = ['Rekayasa Perangkat Lunak','Teknik Elektronika Industri','Teknik Pemesinan'];
  const classes = ['XI RPL 1','XI TEI 2','X TPM 1','XI RPL 2','X TEI 1','XI TPM 1'];
  const today = localDate().date;
  for (let i=0;i<names.length;i++) {
    const id = (await first(db,'INSERT INTO members(full_name,class_name,division,fingerprint_id,fingerprint_device) VALUES ($1,$2,$3,$4,$5) RETURNING id',names[i],classes[i%6],divisions[i%3],i<21?i+1:null,i<21?device:null)).id;
    if (i<20) await rows(db,'INSERT INTO attendances(member_id,date,check_in_time,method,status) VALUES ($1,$2,$3,$4,$5)',id,today,i<18?`07:${String(7+i).padStart(2,'0')}`:null,i<14?'esp32_c1_fingerprint':'manual',i<18?'present':i===18?'excused':'competition');
    if (i<18) await rows(db,'INSERT INTO picket_schedules(day_of_week,member_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',i%6+1,id);
    if (i<3 && weekday(today)) await rows(db,'INSERT INTO picket_schedules(day_of_week,member_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',weekday(today),id);
  }
  const pastCounts=[7,9,12,10,15,11,0,13,16,11,19,15,21];
  for(let offset=1;offset<=pastCounts.length;offset++) {
    const count=pastCounts[offset-1];
    if(!count) continue;
    await rows(db,`INSERT INTO attendances (member_id,date,check_in_time,check_out_time,method,status)
      SELECT id,$1::date-$2::integer,time '07:25',time '15:35','esp32_c1_fingerprint','present'
      FROM members ORDER BY id LIMIT $3`,today,offset,count);
    await rows(db,`INSERT INTO attendances (member_id,date,method,status)
      SELECT id,$1::date-$2::integer,'manual','excused' FROM members ORDER BY id OFFSET $3 LIMIT $4`,today,offset,count,offset%3+1);
  }
  await rows(db,'UPDATE devices SET last_seen=now() + interval \'1 day\' WHERE id=$1',device);
  await rows(db,`INSERT INTO reports (kind,date,division,caption,photo_key,demo_asset,verification_status,submitted_by_email) VALUES
    ('dokumentasi',$1,'Teknik Pemesinan','Perakitan prototipe rover di meja kerja','demo-rover',true,'pending','admin@gmail.com'),
    ('piket',$1,null,'Pengecekan dan penataan meja kerja lab','demo-workbench',true,'approved','admin@gmail.com')`,today);
  return { admin:admin.id,viewer:viewer.id };
}
