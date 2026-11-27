import svgFiles from './icons.js';
export function icon(name,size=20) {
  return (svgFiles['/node_modules/lucide/icons/'+name+'.svg']||'').replace('<svg','<svg aria-hidden="true"').replace('width="24"','width="'+size+'"').replace('height="24"','height="'+size+'"');
}
export const h=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const initials=name=>String(name??'ELITE').trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase();
export const shortTime=value=>value?.slice(0,5)||'—';
export const formatDate=(value,full=false)=>new Intl.DateTimeFormat('id-ID',{...(full?{weekday:'long'}:{}),day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date(value+'T12:00:00+07:00'));
export const days=['Senin','Selasa','Rabu','Kamis','Jumat'];
export function memberStudy(member) {
  const major=['Programming','Elektronik','Mekanik'].includes(member.division)?'':member.division;
  return [member.class_name,major].filter(Boolean).join(' · ');
}
export const labels={present:'Hadir',absent:'Tidak hadir',unmarked:'Belum tercatat',excused:'Izin',competition:'Lomba / Dispensasi',pending:'Menunggu Cek Admin',approved:'Disetujui',rejected:'Perlu Revisi',admin:'Admin',viewer:'Pelihat'};
export const badge=status=>'<span class="badge '+h(status)+'"><i></i>'+h(labels[status]??status)+'</span>';
export const tags=values=>values.map(value=>'<option>'+h(value)+'</option>').join('');
export const empty=(message)=>'<p class="empty">'+h(message)+'</p>';
export const btn=(label,action,style='primary',glyph='')=>'<button type="button" class="btn '+style+'" data-action="'+action+'">'+(glyph?icon(glyph,17):'')+h(label)+'</button>';
export function roster(items) {
  if(!items.length) return empty('Belum ada petugas terjadwal.');
  return '<ul class="roster">'+items.map(x=>'<li><span class="avatar">'+h(initials(x.full_name))+'</span><span><strong>'+h(x.full_name)+'</strong><small>'+h(memberStudy(x))+'</small></span></li>').join('')+'</ul>';
}
export function reports(items,isAdmin=false) {
  if(!items.length) return empty('Belum ada laporan foto.');
  return '<div class="report-grid">'+items.map(r=>'<article class="report"><button class="report-image" type="button" data-action="photo:'+r.id+'" aria-label="Buka foto '+h(r.caption)+'"><img src="'+h(r.photo_url)+'" loading="lazy" width="480" height="260" alt="'+h(r.caption)+'"></button><div class="report-body"><div class="report-meta"><span>'+h(r.kind==='piket'?'Piket Lab':r.division)+'</span><span>'+formatDate(r.date)+'</span></div><h3>'+h(r.caption)+'</h3><small>'+h(r.submitted_by_email)+'</small><div class="report-status">'+badge(r.verification_status)+(isAdmin&&r.verification_status==='pending'?btn('Periksa','review:'+r.id,'outline','shield-check'):'')+'</div>'+(r.verification_note?'<p class="note">'+h(r.verification_note)+'</p>':'')+'</div></article>').join('')+'</div>';
}
