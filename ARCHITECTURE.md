# Arsitektur ELITE

```mermaid
flowchart LR
  U[Browser Admin atau Pelihat] -->|HTTPS dan cookie sesi| API[Express + REST]
  API <-->|SQL dan transaksi| DB[(PostgreSQL)]
  API -->|WebP privat| DB
  S[Sensor AS608 / R307] -->|UART dan ID slot| I[ESP32-C3]
  I -->|HTTPS dan X-Device-Token| API
```

Next.js menyajikan landing page dan meneruskan /api ke Express. PostgreSQL menyimpan akun, jadwal, absensi, serta foto WebP privat. Demo menggunakan PGlite dalam memori.

Anggota mendaftarkan email dan kata sandi. Setelah admin mengaktifkan akun, login membuka sesi dengan cookie HttpOnly dan token yang disimpan sebagai hash. Pencabutan akses menutup sesi.

Sensor mencocokkan template secara lokal. Perangkat mengirim ID slot dan UUID transaksi ke server. Heartbeat mengatur status online dengan ambang 90 detik. Server membuat satu catatan per anggota dan tanggal WIB, lalu mengisi jam pulang pada scan berikutnya. Scan baru dalam 90 detik setelah scan yang diterima dianggap ganda. UUID yang sama mengembalikan hasil sebelumnya. Setelah pulang tercatat, scan selanjutnya menjaga catatan yang ada. Admin dapat koreksi melalui input manual. Browser menyegarkan daftar presensi hari ini dan ringkasan dashboard setiap 12 detik. Halaman operasional menampilkan tren 7 atau 14 hari. Riwayat admin dicatat dalam transaksi yang sama dengan perubahan absensi manual, verifikasi laporan, tautan fingerprint, atau akses email. Riwayat tersedia khusus Admin.

Laporan memakai satu tabel dengan jenis `piket` atau `dokumentasi`. Piket menyimpan snapshot petugas saat laporan dibuat. Absensi pembanding mengikuti data tanggal laporan, dan dokumentasi membandingkan anggota dari divisi laporan. Catatan wajib saat keputusan **Perlu Revisi**. Tabel menyimpan pengunggah, pemeriksa, dan waktu pemeriksaan.

## Kontrak REST

Semua rute berikut berawalan `/api`. POST/PUT/PATCH/DELETE browser menggunakan origin yang sama dan sesi sesuai peran.

| Metode dan path | Akses dan input |
|---|---|
| `GET /session` | Publik. Mengembalikan pengguna aktif atau null dan status demo |
| `POST /auth/signup`, `POST /auth/signin` | Daftar dengan nama, email dan kata sandi. Masuk menggunakan email dan kata sandi |
| `POST /auth/reset` | Pemulihan menggunakan email, kode sekali pakai dan kata sandi baru. Sesi lama dicabut. |
| `POST /auth/logout` | Mengakhiri sesi browser |
| `GET /overview` | Pengguna aktif. Ringkasan hari ini, perangkat, petugas, laporan |
| `GET /insights` | Pengguna aktif. Empat belas hari rekap dalam WIB dan sampai enam aktivitas dari tujuh hari terakhir |
| `GET /admin/audit` | Admin. Maksimum 30 tindakan terbaru dengan akun pelaku, detail, dan waktu |
| `GET /attendance?date=YYYY-MM-DD` | Pengguna aktif. Tanggal opsional, default hari ini. `roster=true` menyertakan semua anggota aktif pada hari ini dengan status `unmarked` bila belum ada presensi |
| `PUT /attendance` | Admin. `member_id,date,status,check_in_time,check_out_time,notes`. Jam HH:mm atau null. Status present, absent, excused, competition. Status selain present mengharuskan kedua jam bernilai null |
| `GET /picket?day=1` | Pengguna aktif. Senin = 1, Sabtu = 6 |
| `POST /picket`, `DELETE /picket/:id` | Admin. Jadwalkan `{day,member_id}` atau hapus jadwal |
| `GET /reports?kind=piket&before=25` | Pengguna aktif. `kind` dan kursor `before` opsional. Maksimum 24 laporan, urut ID terbaru. `pending=true` khusus admin |
| `GET /reports/:id/photo` | Pengguna aktif. Mengembalikan WebP |
| `POST /reports` | Admin. Multipart `kind,date,caption,photo`, serta `division` wajib untuk dokumentasi. Foto upload max 5 MB |
| `GET /admin/reports/:id/context` | Admin. Foto, absensi pembanding dan petugas |
| `PATCH /admin/reports/:id` | Admin. JSON `{status,note}`, status approved atau rejected |
| `GET /admin/members`, `POST /admin/members` | Admin. Buat profil dengan `full_name,class_name,division`. Kolom `division` menyimpan jurusan sekolah |
| `PATCH /admin/members/:id/fingerprint` | Admin. `{fingerprint_id}` dengan nomor slot atau null |
| `GET /admin/users`, `POST /admin/users` | Admin. Aktifkan alamat email dan peran melalui `{email,role}` |
| `DELETE /admin/users/:id` | Admin. Cabut akun beserta sesi |
| `POST /iot/heartbeat` | Perangkat. JSON `{device_id}` dan header X-Device-Token |
| `POST /iot/fingerprint-attendance` | Perangkat. Payload di bawah dan header X-Device-Token |

```json
{
  "device_id": "ESP32-C3-LAB-01",
  "fingerprint_id": 12,
  "event_id": "935d4ddc-fc18-479d-8da3-28300d488b61"
}
```

Contoh respons HTTP 200: `{"status":"success","name":"Budi","type":"IN"}`. Nilai `type` bisa IN, OUT, DUPLICATE, atau UNCHANGED. Slot tidak terhubung menghasilkan 404. Token invalid menghasilkan 401. Ulangi scan yang sama dengan UUID semula jika respons belum diterima. UUID baru dipakai untuk pemindaian baru.

## Ukuran dan kompatibilitas

Gambar galeri dimuat secara lazy. Foto unggahan diubah ukurannya menjadi maksimum 1600 piksel pada sisi terpanjang dan dikonversi WebP di server. Browser lebih dahulu mengompresi format yang dapat didekode secara lokal. Untuk HEIC mentah, dukungan dekode server bergantung pada build libvips. Ekspor sebagai JPEG bila server menolak HEIC. UI menyediakan preferensi reduced motion dan tata letak untuk layar sempit. Uji produksi dengan akun anggota, Postgres eksternal dan unit fisik diperlukan sebelum memakai data sekolah nyata.
