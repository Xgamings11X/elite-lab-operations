function openMembers(owner){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('elite-demo-members:'+owner,1);
    request.onupgradeneeded=()=>{
      const store=request.result.createObjectStore('members',{keyPath:'id',autoIncrement:true});
      store.createIndex('username','username',{unique:true});
      store.createIndex('slot','fingerprint_id',{unique:true});
      store.add({id:1,username:'anggota',full_name:'Anggota Contoh',class_name:'XI',division:'Teknik Elektronika',is_active:true});
    };
    request.onerror=()=>reject(Error('Penyimpanan demo di browser tidak tersedia.'));
    request.onsuccess=()=>resolve(request.result);
  });
}

export async function demoMembers(owner,path,method,body={}){
  const db=await openMembers(owner);
  try{
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction('members',method==='GET'?'readonly':'readwrite');
      const store=tx.objectStore('members');
      let result,failure;
      tx.oncomplete=()=>resolve(result);
      tx.onabort=()=>reject(failure||Error(tx.error?.name==='ConstraintError'?'Username atau nomor slot sudah digunakan.':'Perubahan demo gagal disimpan.'));
      if(method==='GET'){
        const query=store.getAll();
        query.onsuccess=()=>{result=query.result.sort((a,b)=>a.division.localeCompare(b.division,'id')||a.class_name.localeCompare(b.class_name,'id')||a.full_name.localeCompare(b.full_name,'id'));};
        return;
      }
      const id=Number(path.split('/')[3]);
      const query=store.get(id||0);
      query.onsuccess=()=>{
        try{
          const member=query.result||{is_active:true};
          if(method!=='POST'&&!query.result)throw Error('Anggota contoh tidak ditemukan.');
          if(method==='DELETE'){store.delete(id);return;}
          if(!path.endsWith('/fingerprint')){
            for(const key of ['full_name','username','class_name','division']){
              const value=String(body[key]??'').trim();
              if(!value)throw Error('Lengkapi nama, username, kelas dan jurusan.');
              member[key]=key==='username'?value.toLowerCase():value;
            }
            if(!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(member.username))throw Error('Gunakan username 3–40 karakter.');
          }
          if(body.fingerprint_id!=null){
            if(!Number.isInteger(body.fingerprint_id)||body.fingerprint_id<1||body.fingerprint_id>65535)throw Error('Nomor slot tidak valid.');
            member.fingerprint_id=body.fingerprint_id;
          }else delete member.fingerprint_id;
          const write=store.put(member);
          write.onsuccess=()=>{result={id:write.result};};
        }catch(error){failure=error;tx.abort();}
      };
    });
  }finally{db.close();}
}
