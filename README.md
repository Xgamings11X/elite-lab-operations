# ELITE Lab Operations

Portal Electronic Innovation Center untuk ekstrakurikuler Robotik SMKN 2 Surabaya. Antarmuka berbahasa Indonesia dan memakai waktu Asia/Jakarta (WIB).

## Jalankan demo lokal

Perlu Node.js 22.13 atau lebih baru. Dari folder proyek:

```powershell
npm ci
npm run build
npm run demo
```

Buka http://127.0.0.1:4173. Isi OWNER_DEMO_USERNAME dan OWNER_DEMO_PASSWORD di environment server untuk masuk melalui formulir biasa sebagai pelihat data contoh. Dari menu profil, pilih **Lihat sebagai Admin** atau **Lihat sebagai Pelihat** untuk mengganti tampilan demo. Unggahan piket demo disimpan di browser pemilik. Data sesi demo lokal kembali ke kondisi awal saat server dihentikan.

```powershell
npm test
```

Pengujian integrasi mengecek tren absensi 14 hari, perlindungan riwayat admin, autentikasi dan RBAC demo, validasi asal POST, akses foto, upload dan konversi WebP, konteks verifikasi, status revisi, pencabutan sesi, dan scan dengan token perangkat termasuk pengiriman ulang.

## Konfigurasi produksi

Gunakan preset Next.js pada Vercel. Isi DATABASE_URL untuk PostgreSQL, BOOTSTRAP_ADMIN_USERNAME dan BOOTSTRAP_ADMIN_PASSWORD (8–128 karakter) untuk akses admin pertama, serta DEVICE_TOKEN yang sama dengan firmware. APP_URL dapat diisi untuk domain khusus. Tanpa override, produksi menggunakan VERCEL_PROJECT_PRODUCTION_URL. Simpan rahasia hanya di environment server.

Admin awal masuk langsung dengan kredensial bootstrap. Anggota mendaftar dengan nama, username, kata sandi, kelas, dan jurusan. Admin memeriksa pemilik akun lalu mengaktifkan akses melalui Panel Admin. Setelah itu anggota dapat masuk. Kata sandi disimpan menggunakan scrypt dengan salt acak. Cookie sesi akun anggota dan demo berlaku 48 jam sejak masuk.

Setelah daftar, simpan kode pemulihan sekali pakai. Gunakan Masuk → Lupa kata sandi untuk mengganti sandi dan menutup sesi lama. Admin dapat membuat kode pengganti selama 15 menit melalui daftar akses setelah memeriksa identitas pemilik akun. Untuk akun demo pemilik, gunakan username terpisah serta kata sandi 8–128 karakter di environment Production Vercel, lalu redeploy.

Piket berlangsung Senin–Jumat dan presensi ekskul berlangsung Sabtu (WIB). Foto baru disimpan di PostgreSQL. Foto unggahan versi lama membutuhkan direktori STORAGE_DIR asalnya.
## Media dan akun setelah pembaruan

Latar Masuk menggunakan foto bersama ELITE. Latar awal memakai potongan tujuh detik dari video demo ekskul, tanpa audio. Gambar cadangan tampil selama pemuatan dan untuk preferensi pengurangan gerak.

Setelah berpindah dari versi lama, isi BOOTSTRAP_ADMIN_USERNAME dengan username admin hasil migrasi. OWNER_DEMO_USERNAME mengatur nama masuk demo pemilik. Jika hanya OWNER_DEMO_PASSWORD yang disetel, nama masuk demo adalah demo. Password lama tetap digunakan. Aktifkan ulang deployment setelah mengubah environment.

Panduan endpoint, relasi database, migrasi, dan pemeriksaan ujung ke ujung tersedia di [ARCHITECTURE.md](ARCHITECTURE.md). Panduan wiring, library dan enrollment tersedia di [firmware/README.md](firmware/README.md). Template pengaturan papan ada di [secrets.example.h](firmware/elite_fingerprint/secrets.example.h).

## Struktur sumber

| Folder | Isi |
|---|---|
| `frontend/` | Komponen portal, ES modules, Tailwind CSS, navigasi ikon, grafik kehadiran, logo dan favicon, dialog admin |
| `server/` | Express, username dan kata sandi, sesi dan RBAC, upload foto, webhook dan heartbeat |
| `database/schema.sql` | Skema, constraint, dan indeks PostgreSQL |
| `firmware/` | Sketch Arduino/C++, template pengaturan, wiring dan enrollment ESP32-C3 |
| `test/` | Uji integrasi REST dengan data fiktif |
| `compose.yaml` | PostgreSQL lokal opsional |

- [Rancangan arsitektur dan kontrak REST](ARCHITECTURE.md)
- [Panduan firmware dan sensor fingerprint](firmware/README.md)
- [Skema SQL](database/schema.sql)

### Kredit aset demo

Dua foto contoh dibuat dengan ImageGen bawaan. Lokasinya `server/demo-assets/demo-rover.webp` dan `server/demo-assets/demo-workbench.webp`. Prompt ringkasnya adalah foto dokumenter tangan merakit rover di meja lab robotik sekolah vokasi Indonesia, serta foto dokumenter meja lab yang rapi setelah piket. Keduanya menggambarkan ruangan fiktif.

Logo ELITE berasal dari file yang diberikan pemilik proyek. ImageGen bawaan dipakai dengan instruksi hanya menghapus latar putih serta mempertahankan bentuk huruf, warna oranye, dan teks ELECTRONIC INNOVATION CENTER. PNG transparan ada di `frontend/src/elite-logo.png`. Favicon memakai huruf E dari identitas tersebut.
