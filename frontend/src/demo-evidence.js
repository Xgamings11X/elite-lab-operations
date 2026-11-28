async function openStore(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('elite-demo-piket',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('reports',{keyPath:'id'}).createIndex('email','submitted_by_email');
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
export async function saveDemoEvidence(user,form){
  const demoImages={};
  for(const key of ['before','after','group']) demoImages[key]=await dataUrl(form.get(key));
  const db=await openStore();
  try{
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('reports','readwrite');
      tx.oncomplete=resolve;
      tx.onabort=()=>reject(tx.error||Error('Bukti demo gagal disimpan.'));
      tx.objectStore('reports').add({id:crypto.randomUUID(),kind:'piket',date:form.get('date'),participants:form.get('participants'),
        caption:'Bukti piket',created_at:Date.now(),submitted_by_email:user.email,uploader_name:user.name,verification_status:'pending',demoImages});
    });
  }finally{db.close();}
}
export async function demoEvidence(email){
  const db=await openStore();
  try{
    return await new Promise((resolve,reject)=>{
      const request=db.transaction('reports').objectStore('reports').index('email').getAll(email);
      request.onsuccess=()=>resolve(request.result.sort((a,b)=>b.created_at-a.created_at));
      request.onerror=()=>reject(request.error);
    });
  }finally{db.close();}
}
