import { api,compress } from './api.js';
import { badge,btn,empty,formatDate,h,icon,roster,memberStudy } from './ui.js';
import { adminPanel,attendance,attendanceTable,availablePages,dashboard,gallery,home,login,pages,picket,shell } from './views.js';
import { commandLinks,recentActivity,trendChart } from './operations-view.js';

const $=(selector,el=document)=>el.querySelector(selector);
const root=$('#app'),dialog=$('#dialog'),overlay=$('#transition');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
function applyMotion(){
  document.documentElement.dataset.motion=reduced.matches?'calm':'on';
  watchSections();
}
reduced.addEventListener('change',applyMotion);
const state={day:0,date:'',statusFilter:'',attendanceSearch:'',period:7,insights:null,tab:'queue',page:'',items:[],photos:[],overview:null,session:null};
let busy=false,selectedForm,noticeTimer,paintVersion=0,transitionVersion=0;
const isAdmin=()=>state.session.user?.role==='admin';
function notice(message,error=false) {
  const toast=$('#toast');
  toast.textContent=message;
  toast.className=error?'visible error-toast':'visible';
  clearTimeout(noticeTimer);
  noticeTimer=setTimeout(()=>{toast.className='';},4200);
}
const reveals=new IntersectionObserver(entries=>{
  for(const entry of entries) {
    if(!entry.isIntersecting) continue;
    entry.target.classList.add('revealed');
    reveals.unobserve(entry.target);
  }
},{threshold:.08});
function watchSections(){
  reveals.disconnect();
  if(reduced.matches) return;
  for(const item of root.querySelectorAll('.guide-grid article,.week-board,.ops-panel,.quick-grid,.panel,.report,.page-head')) {
    item.classList.add('reveal-ready');
    reveals.observe(item);
  }
}
function animateSetup() {
  overlay.innerHTML='<div class="route-meter"><i></i></div><span class="route-label"></span>';
}
async function transition(task,first=false) {
  const current=++transitionVersion;

  overlay.querySelector('.route-label').textContent=first?'Membuka ELITE':('Membuka '+(pages.find(p=>p[0]===state.page)?.[1]||'halaman'));
  overlay.className='route-loading';
  const previous=root.querySelector('#main');
  if(!first && !reduced.matches) previous?.animate([{opacity:1},{opacity:.72}],{duration:130,fill:'none'});
  try { await task(); }
  finally {
    if(current===transitionVersion){
      const content=root.querySelector('#main');
      content?.animate(reduced.matches?[{opacity:.78},{opacity:1}]:[{opacity:.55,transform:'translateY(14px)'},{opacity:1,transform:'none'}],{duration:reduced.matches?180:340,easing:'cubic-bezier(.2,.8,.2,1)'});
      setTimeout(()=>{if(current===transitionVersion) overlay.className='';},420);
    }
  }
}
function currentPage() {
  const requested=location.hash.match(/^#\/([a-z]+)$/)?.[1];
  return pages.some(([key])=>key===requested) && (requested!=='admin'||isAdmin())?requested:'beranda';
}
const reportUrl=page=>page==='admin'?'/reports?pending=true':page==='piket'?'/reports?kind=piket':'/reports?kind=dokumentasi';
const json=(path,method,data)=>api(path,method,data);
async function paint({replace=false,append=false}={}) {
  if(!state.session.user) return;
  const version=++paintVersion, page=state.page, admin=isAdmin(), tab=state.tab;
  const operational=page==='dashboard';
  const [overview,insights]=await Promise.all([api('/overview'),operational?api('/insights'):null]);
  if(version!==paintVersion) return;
  state.overview=overview;
  state.insights=insights;
  const recentSaturday=new Date(overview.today+'T12:00:00Z');
  recentSaturday.setUTCDate(recentSaturday.getUTCDate()-(recentSaturday.getUTCDay()+1)%7);
  state.date ||= recentSaturday.toISOString().slice(0,10);
  const weekdayNow=new Date(overview.today+"T12:00:00Z").getUTCDay();
  state.day ||= weekdayNow >= 1 && weekdayNow <= 5 ? weekdayNow : 1;
  const day=state.day;
  let output,items,photos,canLoadMore;
  if(page==='beranda') output=home(overview,admin);
  if(page==='dashboard') {
    const queue=admin?(await api('/reports?pending=true')).slice(0,4):[];
    output=dashboard(overview,state.session.user,queue,insights,state.period);
  }
  if(page==='absensi') {
    items=await api('/attendance?roster=true&date='+state.date);
    output=attendance(state,items,admin);
  }
  if(page==='piket'||page==='dokumentasi'||(page==='admin'&&tab==='queue')) {
    const cursor=append&&state.photos.length?'&before='+state.photos.at(-1).id:'';
    photos=await api(reportUrl(page)+cursor);
    canLoadMore=photos.length===24;
    if(append) photos=[...state.photos,...photos];
    if(page==='piket') {
      items=await api('/picket?day='+day);
      output=picket(state,items,photos,admin);
    } else if(page==='dokumentasi') output=gallery(photos,admin);
    else output=adminPanel(tab,photos,state.session.user);
  }
  if(page==='admin'&&tab!=='queue') {
    items=await api('/admin/'+tab);
    output=adminPanel(tab,items,state.session.user);
  }
  if(version!==paintVersion) return;
  state.items=items||[];
  state.photos=photos||[];
  if(replace||!$('#main',root)||!$('.layout',root)) root.innerHTML=shell(state.session.user,state.session.demo,page);
  $('#main').innerHTML=output;
  watchSections();
  if(canLoadMore===false) $('.more-report')?.remove();
  if(page==='absensi') drawAttendance();
}
function drawAttendance() {
  const filter=$('#attendance-status');
  if(!filter) return;
  filter.value=state.statusFilter;
  const search=state.attendanceSearch.trim().toLocaleLowerCase('id');
  const visible=state.items.filter(x=>(!state.statusFilter||x.status===state.statusFilter)&&(!search||(x.full_name+' '+memberStudy(x)).toLocaleLowerCase('id').includes(search)));
  $('#attendance-list').innerHTML=attendanceTable(visible,isAdmin());
  $('#attendance-count').textContent=visible.length+' catatan';
}
async function navigate(first=false) {
  const next=currentPage();
  if(!state.session?.user || (state.page===next&&!first)) return;
  state.page=next;
  await transition(async()=>{
    try {
      await paint({replace:true});
      window.scrollTo(0,0);
      if(!first) $('#main')?.focus({preventScroll:true});
    } catch(error) { notice(error.message,true); }
  },first);
}
function showDialog(title,body,handler=null,submit='Simpan') {
  selectedForm=handler;
  dialog.className=title==='Verifikasi foto'?'wide':title==='Cari halaman'?'command-dialog':'';
  dialog.setAttribute('aria-labelledby','dialog-title');
  dialog.innerHTML=`<div class="dialog-head"><h2 id="dialog-title">${h(title)}</h2><button type="button" class="icon-button" data-action="close" aria-label="Tutup">${icon('x')}</button></div>
   <form id="modal-form"><div class="dialog-content">${body}<p id="form-error" role="alert" class="error" hidden></p></div>
   ${handler?`<div class="dialog-actions">${btn('Batal','close','outline')}<button class="btn primary" type="submit">${h(submit)}</button></div>`:''}</form>`;
  if(!dialog.open) dialog.showModal();
}
function openCommand() {
  showDialog('Cari halaman',commandLinks(availablePages(isAdmin())));
  $('#command-search').focus();
}
const field=(label,control)=>'<label>'+label+control+'</label>';
const option=(value,label,selected=false)=>'<option value="'+h(value)+'" '+(selected?'selected':'')+'>'+h(label)+'</option>';
const memberSelect=(members,id)=>'<select name="member_id" required><option value="">Pilih anggota</option>'+members.filter(x=>x.is_active).map(m=>option(m.id,m.full_name+' · '+m.class_name,m.id===id)).join('')+'</select>';
const currentDate=()=>state.overview.today;
function persist(path,method,makeBody) {
  return async values=>{await api(path,method,makeBody(values));};
}
async function openAction(action,value) {
  const item=state.items.find(x=>x.id===Number(value));
  if(action==='invite') {
    showDialog('Aktifkan akun',field('Alamat email terdaftar','<input name="email" type="email" placeholder="anggota@gmail.com" required>')+
      field('Peran','<select name="role"><option value="viewer">Pelihat</option><option value="admin">Admin</option></select>')+
      '<p class="hint">Pastikan identitas pemilik akun sebelum memberikan akses.</p>',persist('/admin/users','POST',x=>x),'Aktifkan akses');
  }
  if(action==='member') showDialog('Tambah anggota',field('Nama lengkap','<input name="full_name" required minlength="2" maxlength="120">')+
    field('Kelas','<input name="class_name" required maxlength="50">')+field('Jurusan','<input name="division" required maxlength="80" placeholder="Contoh: Teknik Pemesinan">'),persist('/admin/members','POST',x=>x));
  if(action==='link'&&item) showDialog('Tautkan ID presensi',`<p>${h(item.full_name)}</p>`+
    field('Nomor registrasi','<input name="fingerprint_id" type="number" min="1" max="65535" value="'+(item.fingerprint_id??'')+'">')+
    '<p class="hint">Masukkan nomor registrasi anggota. Kosongkan untuk melepas tautan.</p>',
    persist('/admin/members/'+item.id+'/fingerprint','PATCH',x=>({fingerprint_id:x.fingerprint_id?Number(x.fingerprint_id):null})));
  if(action==='revoke'&&item) showDialog('Cabut akses akun',`<p>Akhiri semua sesi dan cabut akses <strong>${h(item.email)}</strong>?</p>`,persist('/admin/users/'+item.id,'DELETE',()=>null),'Cabut akses');
  if(action==='picket-remove'&&item) showDialog('Hapus jadwal petugas',`<p>Hapus <strong>${h(item.full_name)}</strong> dari jadwal hari ini?</p>`,persist('/picket/'+item.id,'DELETE',()=>null),'Hapus jadwal');
  if(action==='picket-add') {
    const members=await api('/admin/members'),day=state.day;
    showDialog('Tambah petugas piket',field('Anggota',memberSelect(members)),persist('/picket','POST',x=>({day,member_id:Number(x.member_id)})));
  }
  if(action==='attendance') {
    const members=await api('/admin/members');
    const record=state.items.find(x=>x.member_id===Number(value));
    showDialog(record?'Koreksi kehadiran':'Catat kehadiran',(record?'<p class="selected-person"><strong>'+h(record.full_name)+'</strong><br>'+h(memberStudy(record))+'</p><input type="hidden" name="member_id" value="'+record.member_id+'">':field('Anggota',memberSelect(members)))+
      field('Tanggal','<input type="date" name="date" required '+(record?'readonly ':'')+'value="'+state.date+'">')+
      field('Status','<select name="status">'+['present','absent','excused','competition'].map((key,i)=>option(key,['Hadir','Tidak hadir','Izin','Lomba / Dispensasi'][i],key===record?.status)).join('')+'</select>')+
      '<div class="form-row">'+field('Jam masuk','<input type="time" name="check_in_time" value="'+(record?.check_in_time?.slice(0,5)||'')+'">')+
      field('Jam pulang','<input type="time" name="check_out_time" value="'+(record?.check_out_time?.slice(0,5)||'')+'">')+'</div>'+
      field('Catatan','<textarea name="notes" maxlength="400" rows="2">'+h(record?.notes)+'</textarea>'),
      persist('/attendance','PUT',x=>({...x,member_id:Number(x.member_id),check_in_time:x.check_in_time||null,check_out_time:x.check_out_time||null})));
    syncTimes();
  }
  if(action==='upload') {
    const doc=value==='dokumentasi';
    showDialog(doc?'Unggah dokumentasi':'Unggah bukti piket',
      field('Tanggal kegiatan','<input name="date" type="date" required value="'+currentDate()+'">')+
      (doc?field('Jurusan','<input name="division" required maxlength="80" placeholder="Contoh: Teknik Pemesinan">'):'')+
      field('Keterangan','<textarea name="caption" required minlength="3" maxlength="500" rows="3" placeholder="Siapa yang hadir dan apa kegiatannya?"></textarea>')+
      field('Pilih file foto','<input type="file" accept="image/*" name="photo">')+
      field('Atau ambil dari kamera HP','<input type="file" accept="image/*" capture="environment" name="camera">')+
      '<p class="hint">Jika keduanya terisi, foto kamera yang dipakai. Foto dikompresi otomatis.</p>',
      async(values,form)=>{
        const photo=[form.elements.camera.files[0],form.elements.photo.files[0]].find(Boolean);
        if(!photo) throw new Error('Pilih atau ambil foto terlebih dahulu.');
        const payload=new FormData();
        for(const key of ['date','division','caption']) if(values[key]) payload.append(key,values[key]);
        payload.append('kind',value);
        payload.append('photo',await compress(photo),'laporan.webp');
        await api('/reports','POST',payload);
      },'Unggah foto');
  }
  if(action==='photo') {
    const source=document.querySelector('[data-action="photo:'+Number(value)+'"] img');
    if(source) showDialog('Foto laporan','<img class="full-photo" src="'+h(source.getAttribute('src'))+'" alt="'+h(source.alt)+'"><p>'+h(source.alt)+'</p>');
  }
  if(action==='review') {
    const {report,attendance:matches,allAttendance,picket:planned}=await api('/admin/reports/'+Number(value)+'/context');
    showDialog('Verifikasi foto',`<div class="review-grid"><section><img class="full-photo" src="${h(report.photo_url)}" alt="${h(report.caption)}"><h3>${h(report.caption)}</h3><p>${formatDate(report.date,true)} · ${h(report.submitted_by_email)}</p>${badge(report.verification_status)}</section><section><h3>Absensi pembanding</h3>${attendanceTable(matches)}${allAttendance.length>matches.length?'<details><summary>Seluruh absensi tanggal ini</summary>'+attendanceTable(allAttendance)+'</details>':''}<h3>Petugas terjadwal</h3>${roster(planned)}</section></div>`+
      field('Keputusan','<select name="status" required><option value="">Pilih keputusan</option><option value="approved">Disetujui</option><option value="rejected">Perlu revisi</option></select>')+
      field('Catatan verifikasi','<textarea name="note" maxlength="500" rows="2" placeholder="Wajib jika perlu revisi"></textarea>'),
      persist('/admin/reports/'+report.id,'PATCH',x=>x),'Simpan keputusan');
  }
}
function syncTimes() {
  const form=$('#modal-form');
  if(!form?.elements.check_in_time) return;
  const present=form.elements.status.value==='present';
  form.elements.check_in_time.disabled=!present;
  form.elements.check_out_time.disabled=!present;
  form.elements.check_in_time.required=present;
}
function renderAccount(mode) {
  root.innerHTML=login(state.session.demo,mode);
  watchSections();
}
root.addEventListener('submit',async event=>{
  const form=event.target;
  if(form.id!=='account-form') return;
  event.preventDefault();
  const submit=form.querySelector('[type=submit]');
  if(submit.disabled) return;
  const values=Object.fromEntries(new FormData(form));
  const signup=form.dataset.mode==='signup';
  submit.disabled=true;
  submit.textContent=signup?'Mendaftarkan…':'Memeriksa…';
  form.setAttribute('aria-busy','true');
  try {
    await api('/auth/'+form.dataset.mode,'POST',values);
    if(signup) {
      renderAccount('signin');
      const next=$('#account-form');
      next.elements.email.value=values.email;
      next.querySelector('.auth-message').textContent='Akun terdaftar. Setelah admin mengaktifkan aksesmu, masuk di sini.';
      next.elements.password.focus();
    } else {state.page='';await getSession();}
  } catch(error) {form.querySelector('.auth-message').textContent=error.message;}
  finally {submit.disabled=false;submit.textContent=signup?'Daftar akun':'Masuk';form.removeAttribute('aria-busy');}
});
async function getSession(boot=false) {
  state.session=await api('/session');
  if(!state.session.user) {state.page='';renderAccount('signup');return;}
  if(boot) {
    state.page=currentPage();
    await paint({replace:true});
  } else await navigate(true);
}
document.addEventListener('click',async event=>{
  const route=event.target.closest('.command-links a');
  if(route) {dialog.close();return;}
  const button=event.target.closest('[data-action]');
  if(!button||busy) return;
  const [action,value]=button.dataset.action.split(':');
  try {
    if(action==='authMode') {renderAccount(value);$('#account-form input').focus();return;}
    if(action==='close') return dialog.close();
    if(action==='menu') {
      const opened=$('.layout').classList.toggle('nav-open');
      button.setAttribute('aria-expanded',opened);
      return;
    }
    if(action==='command') return openCommand();
    if(action==='period') {
      state.period=Number(value);
      const container=$('#attendance-trend');
      container.innerHTML=trendChart(state.insights.trend,state.period);
      container.querySelector('[aria-pressed=true]').focus({preventScroll:true});
      return;
    }
    if(action==='chartDay') {
      for(const bar of document.querySelectorAll('.trend-bar')) bar.setAttribute('aria-pressed',bar===button);
      const { date,value:present,excused }=button.dataset;
      $('.trend-selection').textContent=date+' · '+present+' hadir · '+excused+' izin atau dispensasi';
      return;
    }
    if(action==='roles') return showDialog('Ganti peran demo','<div class="login-actions">'+btn('Mode Admin','role:admin','primary','shield-check')+btn('Mode Pelihat','role:viewer','outline','users')+'</div>');
    busy=true;
    if(action==='role'||action==='logout') {
      if(dialog.open) dialog.close();
      await json('/auth/'+(action==='role'?'demo':'logout'),'POST',action==='role'?{role:value}:null);
      state.page='';
      state.tab='queue';
      history.replaceState(null,'',location.pathname+'#/beranda');
      return await getSession();
    }
    if(action==='day') {state.day=Number(value);return await paint();}
    if(action==='adminTab') {
      state.tab=value;
      if(state.page!=='admin') {location.hash='/admin';return;}
      return await paint();
    }
    if(action==='more') return await paint({append:true});
    await openAction(action,value);
  } catch(error) {notice(error.message,true);}
  finally {busy=false;}
});
document.addEventListener('input',event=>{
  if(event.target.id==='attendance-search') {state.attendanceSearch=event.target.value;drawAttendance();}
  if(event.target.id==='command-search') {
    const query=event.target.value.trim().toLocaleLowerCase('id');
    const links=[...dialog.querySelectorAll('.command-links a')];
    for(const link of links) link.hidden=!link.textContent.toLocaleLowerCase('id').includes(query);
    $('.command-empty').hidden=links.some(link=>!link.hidden);
  }
});
document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&state.session?.user&&!dialog.open) {
    event.preventDefault();
    openCommand();
  }
  if(event.key==='Enter'&&event.target.id==='command-search') {
    event.preventDefault();
    dialog.querySelector('.command-links a:not([hidden])')?.click();
  }
});
document.addEventListener('change',async event=>{
  if(event.target.name==='status') {
    syncTimes();
    const note=$('#modal-form')?.elements.note;
    if(note) note.required=event.target.value==='rejected';
  }
  if(event.target.id==='attendance-status') {state.statusFilter=event.target.value;drawAttendance();}
  if(event.target.id==='attendance-date'&&event.target.value) {
    if(new Date(event.target.value+'T12:00:00Z').getUTCDay()!==6){event.target.value=state.date;notice('Pilih hari Sabtu untuk melihat absensi ekskul.',true);return;}
    state.date=event.target.value;
    try { await paint(); } catch(error) { notice(error.message,true); }
  }
});
dialog.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!selectedForm||busy) return;
  const form=event.target,submit=event.submitter,error=$('#form-error');
  const values=Object.fromEntries(new FormData(form).entries());
  busy=true;
  error.hidden=true;
  if(submit) submit.disabled=true;
  try {
    await selectedForm(values,form);
    dialog.close();
    notice('Perubahan tersimpan.');
    try {await paint();} catch(failure) {notice('Tersimpan. Muat ulang untuk memperbarui tampilan.',true);}
  } catch(failure) {error.textContent=failure.message;error.hidden=false;}
  finally {busy=false;if(submit)submit.disabled=false;}
});
dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
$('.skip').addEventListener('click',event=>{
  event.preventDefault();
  const main=$('#main');
  main?.focus();
  main?.scrollIntoView({block:'start'});
});
window.addEventListener('hashchange',()=>navigate());
setInterval(async()=>{
  if(!state.session?.user||document.hidden||dialog.open||busy) return;
  try {
    const overview=await api('/overview');
    state.overview=overview;
    const rate=overview.summary.members?Math.round(overview.summary.present/overview.summary.members*100):0;
    for (const [key,value] of Object.entries({present:overview.summary.present,members:overview.summary.members,rate,picket:overview.picket.length,pending:overview.summary.pending,reports:overview.reports.length})) {
      const element=document.querySelector('[data-kpi="'+key+'"]');
      if(element && value!==undefined) element.textContent=value;
    }
    const activity=$('#recent-activity');
    if(activity) {
      const insights=await api('/insights');
      if(activity.isConnected) {
        activity.innerHTML=recentActivity(insights.activity);
        const chart=$('#attendance-trend');
        const selected=chart.querySelector('.trend-bar[aria-pressed=true]');
        const trendChanged=JSON.stringify(insights.trend)!==JSON.stringify(state.insights?.trend);
        if(trendChanged && !chart.contains(document.activeElement) && selected?.closest('.today-bar')) chart.innerHTML=trendChart(insights.trend,state.period);
        state.insights=insights;
        $('#today-roster').innerHTML=roster(overview.picket);
      }
    }
    if(state.page==='absensi' && state.date===overview.today) {
      const date=state.date,items=await api('/attendance?roster=true&date='+date);
      if(state.page==='absensi' && state.date===date && !dialog.open) {state.items=items;drawAttendance();}
    }
  } catch(error) {
    try {
      const session=await api('/session');
      if(!session.user) await getSession();
    } catch { /* Browser may be offline. */ }
  }
},12000);
animateSetup();
applyMotion();
transition(()=>getSession(true),true)
  .catch(error=>{overlay.className='';state.session={user:null,demo:false};renderAccount('signup');notice('Koneksi ke layanan anggota sedang terganggu.',true);});
