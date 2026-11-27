import eliteLogo from './elite-logo.png';
import { badge,btn,days,divisions,empty,formatDate,h,icon,initials,reports,roster,shortTime,tags } from './ui.js';
import { deviceSummary,metricCards,operationsBoard,quickNav,recentActivity,reviewQueue } from './operations-view.js';

export const pages=[
  ['beranda','Beranda','house'],['dashboard','Dashboard','layout-dashboard'],['absensi','Absensi Anggota','fingerprint'],
  ['piket','Jadwal Piket','calendar-days'],['dokumentasi','Dokumentasi Foto','camera'],['admin','Panel Admin','shield-check'],
];
export const availablePages=admin=>admin?pages:pages.slice(0,5);
const logo=()=>'<img class="elite-wordmark" src="'+eliteLogo+'" width="540" height="180" alt="ELITE — Electronic Innovation Center">';
const link=(slug,label,glyph,current)=>'<a href="#/'+slug+'" '+(slug===current?'aria-current="page"':'')+'>'+icon(glyph,18)+'<span>'+label+'</span>'+(slug===current?'<i></i>':'')+'</a>';
export function shell(user,demo,current) {
  const label=pages.find(x=>x[0]===current)[1];
  return `<div class="layout">
    <aside class="sidebar" id="sidebar"><a class="brand" href="#/beranda" aria-label="ELITE Beranda">${logo()}</a>
      <p class="nav-caption mono">RUANG KERJA</p>
      <nav aria-label="Navigasi utama">${pages.slice(0,5).map(x=>link(...x,current)).join('')}</nav>
      ${user.role==='admin'?'<p class="nav-caption mono manage">MANAJEMEN</p><nav aria-label="Manajemen">'+link(...pages[5],current)+'</nav>':''}
      <div class="side-bottom"><div class="mini-device"><span class="mini-cpu">${icon('cpu',18)}</span><div><strong>ESP32-C1</strong><small id="side-device">Memuat status</small></div></div>
      <div class="side-footer">Robotik SMKN 2 Surabaya</div></div>
    </aside>
    <div class="workspace"><header class="topbar">
      <button class="menu icon-button" aria-controls="sidebar" aria-expanded="false" data-action="menu" aria-label="Buka menu">${icon('menu')}</button>
      <a class="mobile-brand" href="#/beranda" aria-label="ELITE Beranda">${logo()}</a><div class="crumb"><span>Ruang kerja</span>${icon('chevron-right',14)}<strong>${label}</strong></div>
      <div class="top-right"><button class="search-trigger" type="button" data-action="command" aria-label="Cari halaman">${icon('search',17)}<span>Cari halaman</span><kbd>${/Mac/i.test(navigator.platform)?'⌘':'Ctrl'} K</kbd></button>
      ${demo?'<button class="demo-label" data-action="roles" title="Ganti peran demo">Demo</button>':''}<details class="account"><summary><span class="profile-avatar">${h(initials(user.name||user.email))}</span><span class="account-text"><strong>${h(user.name||user.email)}</strong><small>${user.role==='admin'?'Admin':'Pelihat'}</small></span>${icon('chevron-down',15)}</summary><div class="account-menu"><span>${h(user.email)}</span>${demo?btn('Ganti peran demo','roles','outline','users'):''}${btn('Keluar','logout','outline','log-out')}</div></details></div>
    </header><main id="main" tabindex="-1" class="content"></main><footer class="workspace-footer"><span>Electronic Innovation Center</span><span>Robotik SMKN 2 Surabaya</span></footer></div></div>`;
}

export function login(demo,error) {
  return `<main id="main" tabindex="-1" class="login-layout"><section class="login-card"><h1>Masuk ke portal ELITE</h1>
    <p>Gunakan akses yang sudah diaktifkan untuk membuka ruang kerja lab robotik.</p>${error?'<p class="error" role="alert">'+h(error)+'</p>':''}
    ${demo?'<div class="login-actions">'+btn('Masuk sebagai Admin','role:admin','primary','shield-check')+btn('Masuk sebagai Pelihat','role:viewer','outline','users')+'</div><small>Mode demo memakai data fiktif dan tersimpan selama server menyala.</small>':'<a class="btn primary" href="/api/auth/google">'+icon('log-in',18)+'Masuk dengan Google</a>'}</section>
    <div class="login-art"><span class="login-symbol">${logo()}</span><small>Robotik SMKN 2 Surabaya</small><div class="login-icons">${['fingerprint','calendar-days','camera'].map(x=>icon(x,21)).join('')}</div></div></main>`;
}
const section=(title,subtitle,action='')=>`<div class="section-head"><div><h2>${title}</h2><p>${subtitle}</p></div>${action}</div>`;
const heading=(label,title,subtitle,action='')=>`<div class="page-head"><div><p class="eyebrow"><i></i> ${label}</p><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`;
const more=(label,slug)=>`<a class="ops-link" href="#/${slug}">${label} ${icon('chevron-right',16)}</a>`;

export function home(o,admin,insights,period) {
  return `<section class="home-hero">
    <div><p class="home-date mono">${icon('calendar-days',16)} ${formatDate(o.today,true)}</p>
    <h1>Operasional <span>Lab.</span></h1><p class="home-lede">Pantau kehadiran, piket, dan kegiatan robotik SMKN 2 Surabaya.</p>
    <div class="home-actions"><a class="btn primary" href="#/dashboard">${icon('layout-dashboard',18)} Buka Dashboard</a></div></div>
    <div data-device-console>${deviceSummary(o.device)}</div>
  </section>
  <div class="home-section"><h2>Akses Cepat</h2>${quickNav(admin)}</div>
  <div class="home-section"><h2>Ringkasan Hari Ini</h2>${metricCards(o,admin)}</div>
  ${operationsBoard(o,insights,period)}`;
}
export function dashboard(o,user,queue,insights,period) {
  const isAdmin=user.role==='admin';
  const title=heading('OPERASIONAL','Dashboard',isAdmin?'Pantau absensi, antrean verifikasi, dan status perangkat.':'Pantau absensi, petugas piket, dan aktivitas lab.',`<span class="access-badge mono">${icon(isAdmin?'shield-check':'user-round',17)} ${isAdmin?'Admin':'Pelihat'}</span>`);
  const queueSection=isAdmin?`<section class="ops-panel dashboard-queue"><div class="ops-panel-head"><div><h2>Antrean Verifikasi Foto</h2><p>Cocokkan laporan dengan absensi dan jadwal piket.</p></div>${more('Panel Admin','admin')}</div>${reviewQueue(queue)}</section>`:'';
  const tools=isAdmin?`<div class="dual admin-shortcuts"><section class="ops-panel"><h2>Pendaftaran Sidik Jari</h2><p>${o.summary.unenrolled} anggota aktif belum ditautkan ke ID sensor.</p>${btn('Kelola fingerprint','adminTab:members','outline','fingerprint')}</section><section class="ops-panel"><h2>Akses Gmail</h2><p>Aktifkan akses untuk admin atau pelihat.</p>${btn('Undang lewat Gmail','invite','outline','mail')}</section></div>`:'';
  return title+`<div class="dashboard-top"><div>${metricCards(o,isAdmin)}</div><div data-device-console>${deviceSummary(o.device)}</div></div>`+queueSection+operationsBoard(o,insights,period)+tools;
}

export function attendanceTable(items,isAdmin=false) {
  return items.length?`<div class="table-wrap"><table><thead><tr><th>Anggota</th><th>Divisi</th><th>Metode</th><th>Masuk</th><th>Pulang</th><th>Status</th>${isAdmin?'<th>Tindakan</th>':''}</tr></thead>
  <tbody>${items.map(a=>`<tr><td><div class="table-person"><span class="avatar">${h(initials(a.full_name))}</span><span><strong>${h(a.full_name)}</strong><small>${h(a.class_name)}${a.notes?' · '+h(a.notes):''}</small></span></div></td><td>${h(a.division)}</td><td>${a.method==='manual'?'Manual Admin':'Fingerprint ESP32-C1'}</td><td class="mono">${shortTime(a.check_in_time)}</td><td class="mono">${shortTime(a.check_out_time)}</td><td>${badge(a.status)}</td>${isAdmin?'<td>'+btn('Edit','attendance:'+a.member_id,'outline')+'</td>':''}</tr>`).join('')}</tbody></table></div>`:empty('Belum ada catatan absensi untuk tanggal ini.');
}
export function attendance(state,items,isAdmin) {
  return heading('PRESENSI','Absensi Anggota','Rekap kehadiran anggota dan sinkronisasi fingerprint.',isAdmin?btn('Input manual','attendance','primary','plus'):'')+
  `<section class="panel"><div class="filter"><label>Tanggal <input id="attendance-date" type="date" value="${state.date}"></label><label>Cari anggota <input id="attendance-search" type="search" placeholder="Nama atau kelas" aria-label="Cari anggota" value="${h(state.attendanceSearch)}"></label><label>Divisi <select id="attendance-division"><option value="">Semua divisi</option>${tags(divisions)}</select></label><span id="attendance-count" class="mono"></span></div><div id="attendance-list">${attendanceTable(items,isAdmin)}</div></section>`;
}
export function picket(state,items,photos,isAdmin) {
  return heading('LAB ROBOTIK','Jadwal Piket','Lihat jadwal petugas lab dan bukti foto piket.',isAdmin?btn('Unggah bukti','upload:piket','primary','camera'):'')+
  `<section class="panel"><div class="tabs" aria-label="Hari piket">${days.map((day,i)=>`<button data-action="day:${i+1}" aria-pressed="${state.day===i+1}">${day}</button>`).join('')}</div>
    ${section('Petugas hari '+days[state.day-1],items.length+' anggota terjadwal',isAdmin?btn('Tambah petugas','picket-add','outline','plus'):'')}
    ${isAdmin&&items.length?'<ul class="roster editable">'+items.map(x=>`<li><span class="avatar">${h(initials(x.full_name))}</span><span><strong>${h(x.full_name)}</strong><small>${h(x.class_name)} · ${h(x.division)}</small></span>${btn('Hapus','picket-remove:'+x.id,'outline')}</li>`).join('')+'</ul>':roster(items)}</section>`+
    section('Bukti foto piket','Riwayat foto petugas dan kondisi lab.')+reports(photos,isAdmin)+moreReports(photos);
}
const moreReports=items=>items.length>=24?`<div class="more-report">${btn('Muat laporan lainnya','more','outline')}</div>`:'';
export function gallery(items,isAdmin) {
  return heading('GALERI LAB','Dokumentasi Foto','Arsip kegiatan dan sesi praktik di lab ELITE.',isAdmin?btn('Unggah dokumentasi','upload:dokumentasi','primary','camera'):'')+reports(items,isAdmin)+moreReports(items);
}
export function adminPanel(tab,data,user) {
  const tabs=[['queue','Verifikasi Foto'],['members','Anggota & Fingerprint'],['users','Akses Gmail'],['audit','Riwayat Perubahan']];
  const head=heading('MANAJEMEN','Panel Admin','Kelola verifikasi, data anggota, dan akses portal.')+
    '<div class="tabs admin-tabs" aria-label="Bagian admin">'+tabs.map(([key,label])=>`<button data-action="adminTab:${key}" aria-pressed="${tab===key}">${label}</button>`).join('')+'</div>';
  if(tab==='queue') return head+section('Antrean Foto','Laporan piket dan dokumentasi yang menunggu pemeriksaan.')+'<div class="ops-panel">'+reviewQueue(data)+'</div>'+moreReports(data);
  if(tab==='audit') return head+section('Riwayat Perubahan','30 tindakan admin terbaru yang tercatat.')+'<div class="ops-panel">'+recentActivity(data,true)+'</div>';
  if(tab==='members') return head+section('Anggota & Fingerprint','Tautkan slot sensor ESP32-C1 ke profil anggota.',btn('Tambah anggota','member','primary','plus'))+
    (data.length?`<div class="table-wrap panel"><table><thead><tr><th>Anggota</th><th>Divisi</th><th>ID Sensor</th><th>Tindakan</th></tr></thead><tbody>${data.map(m=>`<tr><td><strong>${h(m.full_name)}</strong><small>${h(m.class_name)}</small></td><td>${h(m.division)}</td><td class="mono">${m.fingerprint_id??'Belum terdaftar'}</td><td>${btn('Kelola ID','link:'+m.id,'outline','fingerprint')}</td></tr>`).join('')}</tbody></table></div>`:empty('Belum ada anggota.'));
  return head+section('Daftar akses Gmail','Aktifkan Gmail yang diizinkan masuk.',btn('Invite Gmail','invite','primary','mail'))+
    `<div class="table-wrap panel"><table><thead><tr><th>Gmail</th><th>Peran</th><th>Akses</th><th>Tindakan</th></tr></thead><tbody>${data.map(u=>`<tr><td><strong>${h(u.email)}</strong><small>${h(u.name||'')}</small></td><td>${badge(u.role)}</td><td>${u.is_active?(u.signed_in?'Aktif':'Diundang'):'Dicabut'}</td><td>${u.is_active&&u.id!==user.id?btn('Cabut akses','revoke:'+u.id,'outline'):'—'}</td></tr>`).join('')}</tbody></table></div>`;
}
