import { api,compress } from './api.js';
import { badge,btn,evidenceImages,evidenceViews,empty,formatDate,h,icon,roster,memberStudy } from './ui.js';
import { adminPanel,attendance,attendanceTable,availablePages,dashboard,gallery,home,login,pages,picket,shell } from './views.js';
import { commandLinks,recentActivity,trendChart } from './operations-view.js';

import {demoEvidence,saveDemoEvidence} from './demo-evidence.js';

const $=(selector,el=document)=>el.querySelector(selector);
const root=$('#app'),dialog=$('#dialog');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
function applyMotion(){
  document.documentElement.dataset.motion=reduced.matches?'calm':'on';
}
reduced.addEventListener('change',applyMotion);
const state={day:0,date:'',statusFilter:'',attendanceSearch:'',period:7,insights:null,tab:'queue',page:'',items:[],photos:[],overview:null,session:null};
let busy=false,selectedForm,noticeTimer,paintVersion=0;
const isAdmin=()=>state.session.user?.role==='admin';
function notice(message,error=false) {
  const toast=$('#toast');
  toast.textContent=message;
  toast.className=error?'visible error-toast':'visible';
  clearTimeout(noticeTimer);
  noticeTimer=setTimeout(()=>{toast.className='';},4200);
}
function revealItems(items){
  items.forEach((item,index)=>{
    item.style.setProperty('--entry-distance',(reduced.matches?3:12+Math.min(index,5)*4)+'px');
    item.classList.add('ui-enter');
  });
}
const reveals=new IntersectionObserver(entries=>{
  const visible=entries.filter(entry=>entry.isIntersecting).map(entry=>entry.target);
  revealItems(visible);
  visible.forEach(item=>reveals.unobserve(item));
},{threshold:0});
function watchSections(){
  reveals.disconnect();
  const visible=[];
  const elements=root.querySelectorAll('.club-intro h1,.club-lede,.auth-panel,.guide-grid article,.week-board,.quick-link,.ops-metric,.ops-panel,.page-head,.panel,.report,.empty,.admin-tabs,.section-head');
  for(const item of elements){
    const box=item.getBoundingClientRect();
    if(box.top<innerHeight && box.bottom>0) visible.push(item);
    else reveals.observe(item);
  }
  revealItems(visible);
}
function updateNavigation(page){
  for(const link of root.querySelectorAll('.sidebar nav a')){
    if(link.hash==='#/'+page) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
  $('.crumb strong').textContent=pages.find(([slug])=>slug===page)[1];
  $('.layout').classList.remove('nav-open');
  $('.menu').setAttribute('aria-expanded','false');
}
function currentPage() {
  const requested=location.hash.match(/^#\/([a-z]+)$/)?.[1];
  return pages.some(([key])=>key===requested) && (requested!=='admin'||isAdmin())?requested:'beranda';
}
const reportUrl=page=>page==='admin'?'/reports?pending=true':page==='piket'?'/reports?kind=piket':'/reports?kind=dokumentasi';
const json=(path,method,data)=>api(path,method,data);
async function paint({replace=false,append=false,direction=null}={}) {
  if(!state.session.user) return;
  const version=++paintVersion, page=state.page, admin=isAdmin(), tab=state.tab;
  const operational=page==='dashboard';
  const [overview,insights]=await Promise.all([(direction&&state.overview?state.overview:api('/overview')),operational?api('/insights'):null]);
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
    const [records,rosterItems]=await Promise.all([api(reportUrl(page)+cursor),page==='piket'?api('/picket?day='+day):null]);
    photos=records;
    canLoadMore=photos.length===24;
    if(append) photos=[...state.photos,...photos];
    if(page==='piket') {
      items=rosterItems;
      if(state.session.user.owner_demo&&!append) photos=[...await demoEvidence(state.session.user.email),...photos];
      output=picket(state,items,photos,admin);
    } else if(page==='dokumentasi') output=gallery(photos,admin);
    else output=adminPanel(tab,photos,state.session.user);
  }
  if(page==='admin'&&tab!=='queue') {
    items=await api('/admin/'+tab);
    output=adminPanel(tab,items,state.session.user);
  }
  if(version!==paintVersion) return;
  {
    if(version!==paintVersion) return;
    state.items=items||[];
    state.photos=photos||[];
    if(replace||!$('#main',root)||!$('.layout',root)) root.innerHTML=shell(state.session.user,state.session.demo,page);
    if(direction) updateNavigation(page);
    $('#main').innerHTML=output;
    if(direction){window.scrollTo(0,0);$('#main').focus({preventScroll:true});}
    if(replace || direction) watchSections();
    else reveals.disconnect();
    if(canLoadMore===false) $('.more-report')?.remove();
    if(page==='absensi') drawAttendance();
  }
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
  try {
    if(!first && $('#main')){
      updateNavigation(next);
      $('#main').innerHTML='<header class="page-head"><h1>'+h(pages.find(([key])=>key===next)[1])+'</h1></header>';
      window.scrollTo(0,0);
    }
    await paint({replace:first,direction:!first});
  } catch(error) {
    if(state.page===next){
      state.page='';
      if($('#main')) $('#main').innerHTML='<p class="empty">'+h(error.message)+' '+btn('Coba lagi','retryPage','outline')+'</p>';
      notice(error.message,true);
    }
  }
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
  if(action==='upload' && value==='piket'){
    const day=new Date(currentDate()+'T12:00:00Z');
    day.setUTCDate(day.getUTCDate()-(day.getUTCDay()-state.day+7)%7);
    showDialog('Unggah bukti piket',
      field('Tanggal piket','<input type="date" name="date" required value="'+day.toISOString().slice(0,10)+'">')+
      field('Nama petugas dalam foto bersama','<textarea required name="participants" minlength="2" maxlength="500" placeholder="Pisahkan nama dengan koma"></textarea>')+
      evidenceViews.map(([key,label])=>field(label,'<input required type="file" accept="image/*" name="'+key+'">')).join('')+
      '<p class="hint">Diunggah sebagai '+h(state.session.user.name||state.session.user.email)+(state.session.user.owner_demo?'. Bukti demo tersimpan di browser ini.':'.')+'</p>',
      async(values,form)=>{
        if(![1,2,3,4,5].includes(new Date(values.date+'T12:00:00Z').getUTCDay())) throw Error('Pilih hari Senin sampai Jumat.');
        if(values.participants.trim().length<2) throw Error('Isi nama petugas yang hadir.');
        const payload=new FormData();let size=0;
        payload.set('date',values.date);payload.set('participants',values.participants.trim());
        for(const [key] of evidenceViews){
          const image=await compress(form.elements[key].files[0]);size+=image.size;
          payload.set(key,image,'piket.webp');
        }
        if(size>4_000_000) throw Error('Total foto terlalu besar. Pilih foto berukuran lebih kecil.');
        if(state.session.user.owner_demo) await saveDemoEvidence(state.session.user,payload);
        else await api('/picket-reports','POST',payload);
      },'Kirim bukti');
    return;
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
    showDialog('Verifikasi foto',`<div class="review-grid"><section>${report.participants?evidenceImages(report)+'<p>Petugas: '+h(report.participants)+'</p>':'<img class="full-photo" src="'+h(report.photo_url)+'" alt="Foto laporan">'}<h3>${h(report.caption)}</h3><p>${formatDate(report.date,true)} · Diunggah oleh ${h(report.uploader_name||report.submitted_by_email)}</p>${badge(report.verification_status)}</section><section><h3>Absensi pembanding</h3>${attendanceTable(matches)}${allAttendance.length>matches.length?'<details><summary>Seluruh absensi tanggal ini</summary>'+attendanceTable(allAttendance)+'</details>':''}<h3>Petugas terjadwal</h3>${roster(planned)}</section></div>`+
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
function showRecovery(code,temporary=false){
  showDialog('Kode pemulihan', '<p>'+(temporary?'Sampaikan kode secara privat setelah identitas pemilik akun diperiksa. Berlaku 15 menit.':'Simpan kode sekali pakai ini di tempat pribadi untuk memulihkan akunmu.')+'</p><label>Kode pemulihan<input readonly value="'+h(code)+'" style="width:100%" /></label>'+btn('Sudah disimpan','close','primary'));
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
  const originalLabel=submit.textContent;
  submit.disabled=true;
  submit.textContent=signup?'Mendaftarkan…':'Memeriksa…';
  form.setAttribute('aria-busy','true');
  try {
    const result=await api('/auth/'+form.dataset.mode,'POST',values);
    if(result.recovery) {
      renderAccount('signin');
      const next=$('#account-form');
      next.elements.email.value=values.email;
      next.querySelector('.auth-message').textContent=signup?'Akun terdaftar. Masuk setelah admin mengaktifkan akses.':'Kata sandi sudah diganti. Silakan masuk kembali.';
      showRecovery(result.recovery);

    } else {state.page='';await getSession();}
  } catch(error) {form.querySelector('.auth-message').textContent=error.message;}
  finally {submit.disabled=false;submit.textContent=originalLabel;form.removeAttribute('aria-busy');}
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
  const image=event.target.closest('[data-evidence]');
  if(image){
    event.preventDefault();
    const photo=image.querySelector('img');
    if(dialog.open){window.open(photo.src,'_blank','noopener');return;}
    showDialog(photo.alt,'<img class="full-photo" alt="'+h(photo.alt)+'" src="'+h(photo.src)+'">');return;
  }
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
    if(action==='retryPage') return navigate();
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
    if(action==='recovery'){
      const person=state.items.find(p=>p.id===Number(value));
      if(!person)return;
      showDialog('Pemulihan akun', '<p>Verifikasi identitas pemilik '+h(person.email)+' sebelum memberikan kode. Kode pengganti berlaku 15 menit.</p>'+btn('Buat kode','issueRecovery:'+value,'primary'));return;
    }
    if(action==='issueRecovery'){busy=true;const result=await api('/admin/users/'+Number(value)+'/recovery','POST',{});showRecovery(result.recovery,true);return;}
    busy=true;
    if(action==='demoRole' && state.session.user?.owner_demo){
      await json('/demo/role/'+value,'POST',null);
      if(value==='viewer' && state.page==='admin') history.replaceState(null,'',location.pathname+location.search+'#/dashboard');
      state.tab='queue';
      await getSession(true);
      return;
    }
    if(action==='logout') {
      if(dialog.open) dialog.close();
      await json('/auth/logout','POST',null);
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
applyMotion();
getSession(true).catch(()=>{
  if($('.restore-header')){
    const main=$('#main');
    main.removeAttribute('aria-busy');
    main.className='content';
    main.innerHTML='<p>Sesi belum bisa diperiksa. Periksa koneksi, lalu coba lagi.</p><button class="btn outline" type="button">Coba lagi</button>';
    main.querySelector('button').addEventListener('click',()=>location.reload());
    return;
  }
  state.session={user:null,demo:false};
  renderAccount('signup');
  notice('Koneksi ke layanan anggota sedang terganggu.',true);
});
