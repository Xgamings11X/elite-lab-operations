import { btn,empty,h,icon,roster } from './ui.js';

const locale='id-ID',zone='Asia/Jakarta';
const shortDate=new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',timeZone:zone});
const dayName=new Intl.DateTimeFormat(locale,{weekday:'short',timeZone:zone});
const eventDate=new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:zone});
const asDate=value=>new Date(value+'T12:00:00+07:00');
const detailLink=(label,page)=>`<a class="ops-link" href="#/${page}">${label}${icon('chevron-right',16)}</a>`;
const symbols={
  check_in:['log-in','Absensi masuk','mint'],check_out:['log-out','Absensi pulang','blue'],
  activity_report:['camera','Laporan kegiatan','plum'],picket_report:['clipboard-check','Bukti piket','honey'],
  attendance_saved:['fingerprint','Absensi manual disimpan','mint'],
  report_approved:['circle-check','Laporan disetujui','mint'],report_revision:['file-check-2','Revisi diminta','honey'],
  fingerprint_linked:['fingerprint','ID presensi ditautkan','blue'],fingerprint_unlinked:['fingerprint','ID presensi dilepas','blue'],
  access_granted:['shield-check','Akses akun aktif','plum'],access_revoked:['shield-check','Akses akun dicabut','honey'],
};
export const modules=[
  ['absensi','Absensi Anggota','Lihat presensi dan jam masuk','fingerprint','coral'],
  ['piket','Jadwal Piket','Lihat pembagian petugas','calendar-days','mint'],
  ['absensipiket','Absensi Piket','Catat kehadiran dan bukti kegiatan','clipboard-check','honey'],
  ['dokumentasi','Dokumentasi Foto','Lihat arsip kegiatan ELITE','camera','plum'],
  ['dashboard','Dashboard','Ringkasan dan aktivitas anggota','layout-dashboard','blue'],
];
const tile=(glyph,theme,size=22)=>`<span class="ops-icon ${theme}">${icon(glyph,size)}</span>`;

export function metricCards(o,admin) {
  const {present,members,pending}=o.summary;
  const percent=members?Math.round(present/members*100):0;
  const metric=(glyph,theme,label,value,description,page)=>`<a class="ops-metric" href="#/${page}"><span class="metric-top">${tile(glyph,theme,19)}${icon('arrow-up-right',17)}</span><span class="metric-data"><strong>${value}</strong><span>${label}</span></span><small>${description}</small></a>`;
  return `<div class="ops-metrics">
    ${metric('users','coral','Hadir hari ini','<span data-kpi="present">'+present+'</span>','<span data-kpi="rate">'+percent+'</span>% dari <span data-kpi="members">'+members+'</span> anggota aktif','absensi')}
    ${metric('list-checks','mint','Petugas piket','<span data-kpi="picket">'+o.picket.length+'</span>','Dijadwalkan hari ini','piket')}
    ${metric(admin?'shield-check':'images','plum',admin?'Menunggu verifikasi':'Laporan terbaru',admin?'<span data-kpi="pending">'+pending+'</span>':'<span data-kpi="reports">'+o.reports.length+'</span>',admin?'Foto perlu diperiksa':'Foto kegiatan dan piket',admin?'admin':'dokumentasi')}</div>`;
}
export function quickNav(admin) {
  const links=[...modules.slice(0,3),admin?['admin','Panel Admin','Verifikasi dan kelola akses','shield-check','honey']:modules[3]];
  return `<nav class="quick-grid" aria-label="Akses cepat">${links.map(([route,label,description,glyph,theme])=>`<a class="quick-link" href="#/${route}">${tile(glyph,theme)}<span><strong>${label}</strong><small>${description}</small></span>${icon('chevron-right',17)}</a>`).join('')}</nav>`;
}

export function trendChart(trend,period) {
  const data=trend.slice(-period);
  const total=data.reduce((sum,d)=>sum+d.present,0);
  const max=Math.max(4,Math.ceil(Math.max(0,...data.map(d=>d.present+d.excused))/4)*4);
  const columns=data.map((d,i)=>{
    const today=i===data.length-1;
    const date=asDate(d.date);
    const label=period===7?dayName.format(date):date.getUTCDate();
    return `<div class="trend-point ${today?'today-bar':''}"><div class="trend-track"><button type="button"
      aria-pressed="${today}" class="trend-bar" data-action="chartDay:${d.date}" data-value="${d.present}" data-excused="${d.excused}"
      data-date="${h(shortDate.format(date))}" aria-label="${h(shortDate.format(date))}, ${d.present} hadir, ${d.excused} izin atau dispensasi"
      style="--present:${d.present/max*100}%;--excused:${d.excused/max*100}%"><i></i><b></b></button></div>
      <span>${label}</span></div>`;
  }).join('');
  const last=data.at(-1);
  return `<div class="trend-head"><div><p class="trend-total">${total} <span>kehadiran</span></p><p class="trend-selection">${last?`${shortDate.format(asDate(last.date))} · ${last.present} hadir · ${last.excused} izin atau dispensasi`:'Belum ada catatan kehadiran.'}</p></div>
    <div class="period-tabs" aria-label="Rentang tren">${[7,14].map(n=>`<button type="button" data-action="period:${n}" aria-pressed="${n===period}">${n} hari</button>`).join('')}</div></div>
    <div class="trend-plot" style="--columns:${data.length||7}"><div class="trend-axis" aria-hidden="true"><span>${max}</span><span>${max/2}</span><span>0</span></div><div class="trend-columns">${columns}</div></div>
    <div class="trend-legend"><span><i></i>Hadir</span><span><i></i>Izin atau dispensasi</span></div>`;
}
export function recentActivity(items,audit=false) {
  if(!items.length) return empty(audit?'Belum ada perubahan admin yang tercatat.':'Belum ada aktivitas dalam tujuh hari terakhir.');
  return `<ul class="activity-list">${items.map(item=>{
    const [glyph,label,theme]=symbols[item.action];
    const time=eventDate.format(new Date(item.happened_at||item.created_at));
    return `<li>${tile(glyph,theme,17)}<span><strong>${h(item.title||item.detail)}</strong><small>${label}${audit?' · '+h(item.actor_username):''}</small></span><time datetime="${h(item.happened_at||item.created_at)}">${time}</time></li>`;
  }).join('')}</ul>`;
}
export function reviewQueue(items) {
  if(!items.length) return empty('Semua laporan di antrean sudah diperiksa.');
  return `<ul class="activity-list queue-list">${items.map(item=>`<li>${tile(item.kind==='piket'?'clipboard-check':'camera',item.kind==='piket'?'mint':'plum',20)}
    <span><strong>${h(item.caption)}</strong><small>${item.kind==='piket'?'Bukti piket':h(item.division)} · ${shortDate.format(asDate(item.date))}</small></span>
    ${btn('Periksa','review:'+item.id,'outline','shield-check')}</li>`).join('')}</ul>`;
}
export function operationsBoard(data,insights,period) {
  return `<div class="ops-board">
    <section class="ops-panel"><div class="ops-panel-head"><div><h2>Tren Kehadiran</h2><p>Rekap absensi per hari</p></div>${tile('chart-no-axes-column','neutral',19)}</div><div id="attendance-trend">${trendChart(insights.trend,period)}</div></section>
    <section class="ops-panel"><div class="ops-panel-head"><div><h2>Aktivitas Terbaru</h2><p>Presensi dan laporan kegiatan</p></div>${tile('activity','neutral',19)}</div><div id="recent-activity">${recentActivity(insights.activity)}</div></section>
    <section class="ops-panel ops-roster"><div class="ops-panel-head"><div><h2>Petugas Piket Hari Ini</h2><p>Jadwal piket anggota</p></div>${detailLink('Lihat jadwal','piket')}</div><div id="today-roster">${roster(data.picket)}</div></section>
  </div>`;
}
export function commandLinks(pages) {
  return `<label class="command-search">${icon('search',20)}<input id="command-search" type="search" placeholder="Cari absensi, piket, atau halaman lain" aria-label="Cari halaman" autocomplete="off" autofocus></label>
    <nav class="command-links" aria-label="Hasil pencarian halaman">${pages.map(([route,label,glyph])=>`<a href="#/${route}">${tile(glyph,'neutral',17)}<span>${label}</span>${icon('arrow-up-right',16)}</a>`).join('')}</nav>
    <p class="empty command-empty" hidden>Tidak ada halaman yang sesuai.</p>`;
}
