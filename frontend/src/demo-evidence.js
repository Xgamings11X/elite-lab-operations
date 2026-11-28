async function openStore(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('elite-demo-piket',2);
    request.onupgradeneeded=()=>{
      const store=request.result.objectStoreNames.contains('reports')?request.transaction.objectStore('reports'):request.result.createObjectStore('reports',{keyPath:'id'});
      store.createIndex('username','submitted_by_username');
      store.openCursor().onsuccess=event=>{
        const cursor=event.target.result;
        if(cursor){const report=cursor.value;if(report.submitted_by_email){report.submitted_by_username=report.submitted_by_email.split('@')[0];delete report.submitted_by_email;cursor.update(report);}cursor.continue();}
      };
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
function dataUrl(blob){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
export async function saveDemoEvidence(user,form,roster){
  const demoImages={};
  for(const key of ['before','after','group']) demoImages[key]=await dataUrl(form.get(key));
  const db=await openStore();
  try{
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('reports','readwrite');
      tx.oncomplete=resolve;
      tx.onabort=()=>reject(tx.error||Error('Bukti demo gagal disimpan.'));
      tx.objectStore('reports').add({id:crypto.randomUUID(),kind:'piket',date:form.get('date'),present_ids:form.get('present_ids').split(',').map(Number),participants:roster.filter(m=>form.get('present_ids').split(',').includes(String(m.member_id))).map(m=>m.full_name).join(', '),
        caption:'Bukti piket',created_at:Date.now(),submitted_by_username:user.username,uploader_name:user.name,verification_status:'pending',demoImages});
    });
  }finally{db.close();}
}
export async function demoEvidence(username){
  const db=await openStore();
  try{
    return await new Promise((resolve,reject)=>{
      const request=db.transaction('reports').objectStore('reports').index('username').getAll(username);
      request.onsuccess=()=>resolve(request.result.sort((a,b)=>b.created_at-a.created_at));
      request.onerror=()=>reject(request.error);
    });
  }finally{db.close();}
}
