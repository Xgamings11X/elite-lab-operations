export async function api(path,method='GET',body) {
  const multipart=body instanceof FormData;
  const response=await fetch('/api'+path,{method,
    headers:body && !multipart?{'Content-Type':'application/json'}:undefined,
    body:body?(multipart?body:JSON.stringify(body)):undefined});
  if(response.status===204) return null;
  const data=await response.json();
  if(!response.ok) throw new Error(data.error || data.message || 'Permintaan gagal.');
  return data;
}
export async function compress(file) {
  if (file.size>25*1024*1024) throw new Error('Ukuran foto sumber maksimal 25 MB.');
  let bitmap;
  try { bitmap=await createImageBitmap(file,{imageOrientation:'from-image'}); }
  catch {
    if(file.size<=5*1024*1024 && (/\.(heic|heif)$/i.test(file.name)||/hei[cf]/i.test(file.type))) return file;
    throw new Error('Foto tidak dapat dibuka. Coba JPEG, PNG, atau WebP.');
  }
  try {
    const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));
    canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext('2d',{alpha:false});
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const result=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.8));
    if(!result) throw new Error('Foto gagal dikompresi.');
    return result;
  } finally { bitmap.close(); }
}
