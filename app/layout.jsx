import '@fontsource-variable/space-grotesk/wght.css';
import '@fontsource-variable/plus-jakarta-sans/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import '../frontend/src/style.css';
import '../frontend/src/workspace.css';
import '../frontend/src/club.css';
const title='ELITE • Robotik SMKN 2 Surabaya';
const description='Ruang anggota Electronic Innovation Center. Lihat jadwal piket, absensi ekskul Sabtu, dan dokumentasi kegiatan ELITE.';
const image={url:'/elite-share.png',width:1200,height:630,alt:'ELITE — Electronic Innovation Center, Robotik SMKN 2 Surabaya'};
export const metadata={
  metadataBase:new URL(process.env.APP_URL || 'https://eliteabsensi.vercel.app'),
  title,description,icons:{icon:'/favicon.svg'},
  openGraph:{type:'website',url:'/',siteName:'Electronic Innovation Center',locale:'id_ID',title,description,images:[image]},
  twitter:{card:'summary_large_image',title,description,images:[image]}
};
export default function Layout({children}){return <html lang="id"><body>{children}</body></html>}