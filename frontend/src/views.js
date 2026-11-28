const eliteLogo='/elite-logo.png';
import { badge,btn,days,memberStudy,empty,formatDate,h,icon,initials,reports,roster,shortTime,tags } from './ui.js';
import { metricCards,operationsBoard,quickNav,recentActivity,reviewQueue } from './operations-view.js';

export const pages=[
  ['beranda','Beranda','house'],['dashboard','Dashboard','layout-dashboard'],['absensi','Absensi Anggota','fingerprint'],
  ['piket','Jadwal Piket','calendar-days'],['absensipiket','Absensi Piket','calendar-days'],['dokumentasi','Dokumentasi Foto','camera'],['admin','Panel Admin','shield-check'],
];
export const availablePages=admin=>admin?pages:pages.slice(0,-1);
const logo=()=>'<img class="elite-wordmark" src="'+eliteLogo+'" width="540" height="180" alt="ELITE — Electronic Innovation Center">';
const link=(slug,label,glyph,current)=>'<a href="#/'+slug+'" '+(slug===current?'aria-current="page"':'')+'>'+icon(glyph,18)+'<span>'+label+'</span>'+(slug===current?'<i></i>':'')+'</a>';
function portalFooter(user) {
  return `<footer class="club-footer"><div class="footer-grid"><section><a class="footer-brand" href="#/beranda">${logo()}</a><p>Electronic Innovation Center (ELITE) adalah ekstrakurikuler robotik SMKN 2 Surabaya. Di sini, siswa belajar merancang, merakit, dan menguji robot bersama.</p></section>
    <nav aria-label="Navigasi footer"><h2>Navigasi</h2>${user?'':'<a href="#akun">Akun anggota</a><a href="#kegiatan">Kegiatan ELITE</a>'}${(user?availablePages(user.role==='admin'):[]).map(([route,title])=>`<a href="#/${route}">${title}</a>`).join('')}</nav>
    <section><h2>Temui kami</h2><address>Jl. Tentara Genie Pelajar No. 26, Petemon, Kecamatan Sawahan, Kota Surabaya, Jawa Timur 60252</address><a class="contact-link" href="https://www.google.com/maps/search/?api=1&amp;query=SMKN+2+Surabaya+Jl.+Tentara+Genie+Pelajar+No.+26" target="_blank" rel="noopener">Buka Google Maps ${icon('arrow-up-right',15)}</a></section>
    <section><h2>Hubungi ELITE</h2><a class="footer-social" href="mailto:elitedrive10@gmail.com">${icon('mail',17)} elitedrive10@gmail.com</a><a class="footer-social" href="https://www.instagram.com/official_elite10/" target="_blank" rel="noopener">${icon('camera',17)} @official_elite10</a></section></div>
    <div class="footer-base">© Electronic Innovation Center <span>SMKN 2 Surabaya</span></div></footer>`;
}
export function shell(user,demo,current) {
  const label=pages.find(x=>x[0]===current)[1];
  return `<div class="layout">
    <aside class="sidebar" id="sidebar"><a class="brand" href="#/beranda" aria-label="ELITE Beranda">${logo()}</a>
      <p class="nav-caption mono">RUANG KERJA</p>
      <nav aria-label="Navigasi utama">${pages.slice(0,-1).map(x=>link(...x,current)).join('')}</nav>
      ${user.role==='admin'?'<p class="nav-caption mono manage">MANAJEMEN</p><nav aria-label="Manajemen">'+link(...pages.at(-1),current)+'</nav>':''}
    </aside>
    <div class="workspace"><header class="topbar">
      <button class="menu icon-button" aria-controls="sidebar" aria-expanded="false" data-action="menu" aria-label="Buka menu">${icon('menu')}</button>
      <a class="mobile-brand" href="#/beranda" aria-label="ELITE Beranda">${logo()}</a><div class="crumb"><span>Ruang kerja</span>${icon('chevron-right',14)}<strong>${label}</strong></div>
      <div class="top-right"><button class="search-trigger" type="button" data-action="command" aria-label="Cari halaman">${icon('search',17)}<span>Cari halaman</span></button>
      ${user.owner_demo?btn(user.role==='viewer'?'Ke Admin':'Ke Pelihat','demoRole:'+(user.role==='viewer'?'admin':'viewer'),'outline demo-switch','users'):''}<details class="account"><summary><span class="profile-avatar">${h(initials(user.name||user.username))}</span><span class="account-text"><strong>${h(user.name||user.username)}</strong><small>${user.role==='admin'?'Admin':'Pelihat'}</small></span>${icon('chevron-down',15)}</summary><div class="account-menu"><span>${h(user.username)}</span>${user.owner_demo?btn(user.role==='viewer'?'Lihat sebagai Admin':'Lihat sebagai Pelihat','demoRole:'+(user.role==='viewer'?'admin':'viewer'),'outline','users'):''}${btn('Keluar','logout','outline','log-out')}</div></details></div>
    </header><main id="main" tabindex="-1" class="content"></main>${portalFooter(user)}</div></div>`;
}

const programs=[
  ['calendar-days','Jadwal piket','Lihat pembagian tugas dan giliran piket.'],
  ['clipboard-check','Kehadiran','Telusuri status dan catatan presensi tiap pertemuan.'],
  ['camera','Dokumentasi','Temukan foto kegiatan dan perkembangan proyek anggota.']
];
function programCards(){
  return '<section class="field-guide" id="kegiatan"><h2>Kegiatan ELITE</h2><div class="guide-grid">'+programs.map(([glyph,title,copy])=>'<article>'+icon(glyph,24)+'<h3>'+title+'</h3><p>'+copy+'</p></article>').join('')+'</div></section><section class="week-board"><h2>Pekan di ELITE</h2><div class="week-grid">'+[...days,'Sabtu'].map((d,i)=>'<div><strong>'+d+'</strong><small>'+(i===5?'Absensi ekskul':'Piket')+'</small></div>').join('')+'</div></section>';
}
const backgroundVideo='<video class="club-film" autoplay muted loop playsinline preload="metadata" poster="/elite-bersama.webp" aria-hidden="true" tabindex="-1"><source src="/kegiatan.mp4" type="video/mp4"></video>';
export function login(demo,mode='signup') {
  const signup=mode==='signup', reset=mode==='reset', owner=mode==='demo-signin';
  return `<main class="public-site" id="main" tabindex="-1"><header class="public-nav"><a href="#main" aria-label="ELITE">${logo()}</a><button class="btn outline" data-action="authMode:signin">Masuk</button></header>
  <div class="public-body"><div class="public-grid"><section class="club-hero public-hero club-media"><div class="club-intro"><p class="club-kicker"><i></i> Robotik SMKN 2 Surabaya</p><h1>Electronic<br>Innovation<br><em>Center.</em></h1><p class="club-lede">Dari meja rakit sampai uji coba, ini ruang kegiatan anggota robotik SMKN 2 Surabaya.</p></div>
  </section>
  <section class="auth-panel" id="akun"><div class="auth-tabs">${['signup','signin'].map((m,i)=>'<button type="button" aria-pressed="'+(m===mode)+'" data-action="authMode:'+m+'">'+['Daftar','Masuk'][i]+'</button>').join('')}</div>
  <h2>${signup?'Buat akun anggota':reset?'Pulihkan akun':owner?'Masuk ke demo':'Masuk ke ELITE'}</h2><p>${signup?'Daftarkan akunmu. Admin ELITE akan mengaktifkan akses anggota.':reset?'Masukkan kode pemulihan yang kamu simpan saat mendaftar. Jika hilang, hubungi admin ELITE.':owner?'Gunakan kredensial demo pemilik. Perubahan anggota contoh tersimpan di browser ini.':'Gunakan username dan kata sandi yang sudah terdaftar.'}</p>
  <form id="account-form" data-mode="${mode}">${signup?'<label>Nama lengkap<input name="name" autocomplete="name" required minlength="2" maxlength="120"></label>':''}
  ${signup?'<label>Kelas<input name="class_name" required maxlength="50"></label><label>Jurusan<input name="division" required maxlength="80"></label>':''}
  <label>Username<input type="text" name="username" autocomplete="username" required minlength="3" maxlength="40"></label>
  ${reset?'<label>Kode pemulihan<input name="code" autocomplete="off" required maxlength="100"></label>':''}<label>${reset?'Kata sandi baru':'Kata sandi'}<input type="password" name="password" autocomplete="${signup||reset?'new-password':'current-password'}" required minlength="${signup||reset?8:1}" maxlength="128"></label>
  ${signup||reset?'<small>Gunakan minimal 8 karakter.</small>':''}<p role="status" class="auth-message"></p><button type="submit" class="btn primary">${signup?'Daftar akun':reset?'Simpan kata sandi baru':'Masuk'} ${icon('arrow-right',16)}</button></form>
  ${mode==='signin'?btn('Lupa kata sandi?','authMode:reset','outline'):''}${!owner?btn('Masuk ke demo','authMode:demo-signin','outline'):''}</section></div>${programCards()}</div></main>${portalFooter(null)}`;
}
const section=(title,subtitle,action='')=>`<div class="section-head"><div><h2>${title}</h2><p>${subtitle}</p></div>${action}</div>`;
const heading=(label,title,subtitle,action='')=>`<div class="page-head"><div><p class="eyebrow"><i></i> ${label}</p><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`;
const more=(label,slug)=>`<a class="ops-link" href="#/${slug}">${label} ${icon('chevron-right',16)}</a>`;

export function home(o,admin) {
  return `<section class="club-hero club-media">${backgroundVideo}<div class="club-intro"><p class="club-kicker"><i></i> Robotik SMKN 2 Surabaya</p><h1>Electronic<br>Innovation <em>Center.</em></h1><p class="club-lede">Ruang anggota ELITE untuk mengikuti kegiatan, melihat jadwal piket, dan melihat dokumentasi anggota.</p><a class="btn primary" href="#/dashboard">${icon('layout-dashboard',17)} Buka dashboard</a></div>
    
    <div class="club-dateline">${icon('calendar-days',16)} ${formatDate(o.today,true)}</div></section>
    <section class="home-section club-directory"><h2>Jelajahi portal</h2>${quickNav(admin)}</section>${programCards()}`;
}
export function devicePanel(device){
  return device?'<section class="panel" id="device-status"><h2>Perangkat presensi</h2><strong>'+h(device.id)+'</strong> · '+badge(device.online?'Online':'Offline')+'<p>Terhubung terakhir '+h(device.last_seen?new Date(device.last_seen).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})+' WIB':'Belum pernah')+'</p><p>'+Number(device.scans||0)+' transaksi scan diterima · '+(device.last_scan?'Terakhir '+h(new Date(device.last_scan).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'}))+' WIB':'Menunggu pengiriman pertama')+(device.delivery_status==='unknown'?' · Slot belum terhubung':'')+'</p></section>':'';
}
export function dashboard(o,user,queue,insights,period) {
  const isAdmin=user.role==='admin';
  const title=heading('OPERASIONAL','Dashboard',isAdmin?'Ringkasan kehadiran, piket hari ini, dan laporan yang menunggu pemeriksaan.':'Pantau absensi, petugas piket, dan aktivitas anggota.',`<span class="access-badge mono">${icon(isAdmin?'shield-check':'user-round',17)} ${isAdmin?'Admin':'Pelihat'}</span>`);
  const queueSection=isAdmin?`<section class="ops-panel dashboard-queue"><div class="ops-panel-head"><div><h2>Antrean Verifikasi Foto</h2><p>Cocokkan laporan dengan absensi dan jadwal piket.</p></div>${more('Panel Admin','admin')}</div>${reviewQueue(queue)}</section>`:'';
  const device=o.device;
  const status=isAdmin?devicePanel(device):'';
  return title+metricCards(o,isAdmin)+status+queueSection+operationsBoard(o,insights,period);
}

export function attendanceTable(items,isAdmin=false) {
  return items.length?`<div class="table-wrap attendance-wrap"><table><thead><tr><th>Anggota</th><th>Masuk</th><th>Pulang</th><th>Status</th><th>Sumber</th>${isAdmin?'<th>Tindakan</th>':''}</tr></thead>
  <tbody>${items.map(a=>`<tr><td><div class="table-person"><span class="avatar">${h(initials(a.full_name))}</span><span><strong>${h(a.full_name)}</strong><small>${h(memberStudy(a))}${a.notes?' · '+h(a.notes):''}</small></span></div></td><td class="mono">${shortTime(a.check_in_time)}</td><td class="mono">${shortTime(a.check_out_time)}</td><td>${badge(a.status)}</td><td>${a.method?badge(a.method==='manual'?'Manual':'Fingerprint'):'—'}</td>${isAdmin?'<td>'+btn('Koreksi','attendance:'+a.member_id,'outline')+'</td>':''}</tr>`).join('')}</tbody></table></div>`:empty('Belum ada catatan absensi untuk tanggal ini.');
}
export function attendance(state,items,isAdmin) {
  return heading('PRESENSI','Absensi Anggota','Periksa kehadiran ekskul setiap Sabtu dan lihat catatan masuk atau pulang.',isAdmin?btn('Catat kehadiran','attendance','primary','plus'):'')+
  `<section class="panel"><div class="filter"><label>Tanggal <input id="attendance-date" type="date" value="${state.date}"></label><label>Cari anggota <input id="attendance-search" type="search" placeholder="Nama, kelas, atau jurusan" aria-label="Cari anggota" value="${h(state.attendanceSearch)}"></label><label>Status <select id="attendance-status"><option value="">Semua status</option><option value="present">Hadir</option><option value="absent">Tidak hadir</option><option value="unmarked">Belum tercatat</option><option value="excused">Izin</option><option value="competition">Dispensasi</option></select></label><span id="attendance-count" class="mono"></span></div><div id="attendance-list">${attendanceTable(items,isAdmin)}</div></section>`;
}
export function picket(state,items,isAdmin) {
  return heading('ELITE','Jadwal Piket','Pembagian petugas rutin setiap hari kerja.')+
  `<section class="panel"><div class="tabs" aria-label="Hari piket">${days.map((day,i)=>`<button data-action="day:${i+1}" aria-pressed="${state.day===i+1}">${day}</button>`).join('')}</div>
    ${section('Petugas hari '+days[state.day-1],items.length+' anggota terjadwal',isAdmin?btn('Tambah petugas','picket-add','outline','plus'):'')}
    ${isAdmin&&items.length?'<ul class="roster editable">'+items.map(x=>`<li><span class="avatar">${h(initials(x.full_name))}</span><span><strong>${h(x.full_name)}</strong><small>${h(memberStudy(x))}</small></span>${btn('Hapus','picket-remove:'+x.id,'outline')}</li>`).join('')+'</ul>':roster(items)}</section>`;
}
const moreReports=items=>items.length>=24?`<div class="more-report">${btn('Muat laporan lainnya','more','outline')}</div>`:'';
export function picketAttendance(date,items,photos,admin){
  const day=new Date(date+'T12:00:00Z'),monday=new Date(day);
  monday.setUTCDate(day.getUTCDate()-day.getUTCDay()+1);
  const tabs=days.map((label,i)=>{
    const target=new Date(monday);target.setUTCDate(monday.getUTCDate()+i);
    const iso=target.toISOString().slice(0,10);
    return '<button data-action="picketDate:'+iso+'" aria-pressed="'+(iso===date)+'">'+label+' '+target.getUTCDate()+'</button>';
  }).join('');
  const n=items.filter(m=>m.status==='present').length;
  return heading('PIKET','Absensi Piket',formatDate(date,true),items.length?btn('Unggah bukti','upload:piket','primary','camera'):'')+
    '<section class="panel"><label>Pilih tanggal <input type="date" id="picket-date" value="'+date+'"></label><div class="tabs">'+tabs+'</div>'+
    section('Rekap petugas',n+' hadir · '+items.filter(m=>m.status==='absent').length+' tidak hadir · '+items.filter(m=>!m.status).length+' belum dicatat')+
    (items.length?'<ul class="roster">'+items.map(m=>'<li><span><strong>'+h(m.full_name)+'</strong><small>'+h(memberStudy(m))+'</small></span>'+badge(m.status||'unmarked')+' <small>'+ (m.recorded_at?new Date(m.recorded_at).toLocaleTimeString('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit'})+' WIB':'')+'</small></li>').join('')+'</ul>':empty('Belum ada petugas untuk tanggal ini.'))+
    '</section>'+section('Bukti kegiatan','Foto sebelum, sesudah, dan foto bersama petugas.')+reports(photos,admin);
}
export function gallery(items,isAdmin) {
  return heading('GALERI ELITE','Dokumentasi Foto','Arsip kegiatan dan sesi praktik bersama ELITE.',isAdmin?btn('Unggah dokumentasi','upload:dokumentasi','primary','camera'):'')+reports(items,isAdmin)+moreReports(items);
}
export function adminPanel(tab,data,user) {
  const tabs=[['queue','Verifikasi Foto'],['members','Daftar Anggota'],['users','Akses akun'],['audit','Riwayat Perubahan']];
  const head=heading('MANAJEMEN','Panel Admin','Kelola verifikasi, data anggota, dan akses portal.')+
    '<div class="tabs admin-tabs" aria-label="Bagian admin">'+tabs.map(([key,label])=>`<button data-action="adminTab:${key}" aria-pressed="${tab===key}">${label}</button>`).join('')+'</div>';
  if(tab==='queue') return head+section('Antrean Foto','Laporan piket dan dokumentasi yang menunggu pemeriksaan.')+'<div class="ops-panel">'+reviewQueue(data)+'</div>'+moreReports(data);
  if(tab==='audit') return head+section('Riwayat Perubahan','30 tindakan admin terbaru yang tercatat.')+'<div class="ops-panel">'+recentActivity(data,true)+'</div>';
  if(tab==='members') return head+section('Daftar Anggota','Tambah anggota atau tautkan nomor slot setelah sidik jari terdaftar pada sensor.',btn('Tambah anggota','member','primary','plus'))+
    (data.length?`<div class="table-wrap panel"><table><thead><tr><th>Anggota</th><th>Slot fingerprint</th><th>Tindakan</th></tr></thead><tbody>${data.map(m=>`<tr><td><strong>${h(m.full_name)}</strong><small>${h(memberStudy(m))}</small></td><td class="mono">${m.fingerprint_id??'Belum terdaftar'}</td><td>${btn('Tautkan fingerprint','link:'+m.id,'outline','fingerprint')+' '+btn('Edit','editMember:'+m.id,'outline')+' '+btn('Hapus','removeMember:'+m.id,'outline')}</td></tr>`).join('')}</tbody></table></div>`:empty('Belum ada anggota.'));
  return head+section('Daftar akses akun','Periksa identitas pendaftar sebelum mengaktifkan akses.',btn('Aktifkan akun','invite','primary','users'))+
    `<div class="table-wrap panel"><table><thead><tr><th>Username</th><th>Peran</th><th>Akses</th><th>Tindakan</th></tr></thead><tbody>${data.map(u=>`<tr><td><strong>${h(u.username)}</strong><small>${h(u.name||'')}</small></td><td>${badge(u.role)}</td><td>${u.is_active?(u.signed_in?'Aktif':'Diundang'):'Nonaktif'}</td><td>${u.role==='viewer'||u.id===user.id?btn('Kode pemulihan','recovery:'+u.id,'outline'):''} ${u.is_active&&u.id!==user.id?btn('Cabut akses','revoke:'+u.id,'outline'):'—'}</td></tr>`).join('')}</tbody></table></div>`;
}
