# ELITE Lab Operations

Portal Electronic Innovation Center untuk ekstrakurikuler Robotik SMKN 2 Surabaya. Antarmuka berbahasa Indonesia dan memakai waktu Asia/Jakarta (WIB).

## Jalankan demo lokal

Perlu Node.js 22.13 atau lebih baru. Dari folder proyek:

```powershell
npm ci
npm run build
npm run demo
```

Buka [http://127.0.0.1:4173](http://127.0.0.1:4173). Pilih **Masuk sebagai Admin** atau **Masuk sebagai Pelihat**. Tombol **Mode demo** berpindah peran. Demo hanya bisa dijalankan di loopback dan memakai data fiktif. Data demo kembali ke kondisi awal setelah proses server dihentikan.

```powershell
npm test
```

Pengujian integrasi mengecek tren absensi 14 hari, perlindungan riwayat admin, autentikasi dan RBAC demo, validasi asal POST, akses foto, upload dan konversi WebP, konteks verifikasi, status revisi, pencabutan sesi, dan scan dengan token perangkat termasuk pengiriman ulang.

## Konfigurasi produksi

1. Siapkan PostgreSQL. Untuk lokal dengan Docker, salin `.env.example` ke `.env`, ubah `POSTGRES_PASSWORD` dan URL koneksi agar cocok, lalu jalankan `docker compose up -d db`. Untuk server terkelola, isi `DATABASE_URL` dengan koneksi terenkripsi yang disediakan penyedia.
2. Di Google Cloud, buat OAuth Client ID bertipe **Web application**. Tambahkan redirect URI persis seperti `APP_URL` + `/api/auth/google/callback`. Contoh lokal `http://localhost:4173/api/auth/google/callback`. Jika consent screen masih dalam status Testing, tambahkan Gmail yang akan dipakai sebagai test user di konsol Google.
3. Isi `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, dan `BOOTSTRAP_ADMIN_EMAIL` di `.env`. Gmail tersebut dipakai untuk bootstrap bila tabel pengguna masih kosong. Pertahankan `DEVICE_ID=ESP32-C1-LAB-01` atau sesuaikan dengan firmware.
4. Buat `DEVICE_TOKEN` acak dan masukkan nilai yang sama di konfigurasi firmware. Contoh pembuatan token di terminal sendiri: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
5. Jalankan `npm run build`, lalu `npm start`. Backend akan menerapkan skema SQL idempoten saat mulai. Dari akun admin pertama, tambahkan anggota, jadwal piket, dan Gmail yang diizinkan. Fitur **Invite Gmail** mengaktifkan akses melalui whitelist. Admin membagikan alamat portal kepada penerima.
6. Untuk penggunaan sekolah, jalankan Express di belakang reverse proxy HTTPS, gunakan `APP_URL` dengan domain HTTPS, dan isi `TRUST_PROXY_HOPS` sesuai jumlah hop proxy yang dikendalikan. Simpan `STORAGE_DIR` pada volume persisten di luar folder aset publik. Cadangkan database dan direktori foto dalam periode yang sama. Sajikan satu instance Express apabila foto masih memakai disk lokal.

Jika frontend dikerjakan dengan hot reload, jalankan backend secara terpisah pada port 4173 lalu `npm run dev`. Setup Google OAuth lokal tetap menggunakan origin backend sebagai redirect resmi.

## Struktur sumber

| Folder | Isi |
|---|---|
| `frontend/` | Vite, ES modules, Tailwind CSS, navigasi ikon, grafik kehadiran, logo dan favicon, dialog admin |
| `server/` | Express, OAuth Google, sesi dan RBAC, upload foto, webhook dan heartbeat |
| `database/schema.sql` | Skema, constraint, dan indeks PostgreSQL |
| `firmware/` | Sketch Arduino/C++, template pengaturan, wiring dan enrollment ESP32-C1 |
| `test/` | Uji integrasi REST dengan data fiktif |
| `compose.yaml` | PostgreSQL lokal opsional |

- [Rancangan arsitektur dan kontrak REST](ARCHITECTURE.md)
- [Panduan firmware dan sensor fingerprint](firmware/README.md)
- [Skema SQL](database/schema.sql)
- [Dokumentasi Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)

### Kredit aset demo

Dua foto contoh dibuat dengan ImageGen bawaan. Lokasinya `server/demo-assets/demo-rover.webp` dan `server/demo-assets/demo-workbench.webp`. Prompt ringkasnya adalah foto dokumenter tangan merakit rover di meja lab robotik sekolah vokasi Indonesia, serta foto dokumenter meja lab yang rapi setelah piket. Keduanya menggambarkan ruangan fiktif.

Logo ELITE berasal dari file yang diberikan pemilik proyek. ImageGen bawaan dipakai dengan instruksi hanya menghapus latar putih serta mempertahankan bentuk huruf, warna oranye, dan teks ELECTRONIC INNOVATION CENTER. PNG transparan ada di `frontend/src/elite-logo.png`. Favicon memakai huruf E dari identitas tersebut.
