# Firmware fingerprint ESP32-C1

Contoh Arduino/C++ ada di `elite_fingerprint/elite_fingerprint.ino`. Identitas perangkat default adalah `ESP32-C1-LAB-01`. Daftar resmi Arduino Espressif tidak menampilkan profil papan bernama ESP32-C1. Cocokkan profil board/core yang diberikan pemasok dengan papan fisik sebelum kompilasi. Contoh memerlukan core dengan UART, Wi-Fi, pustaka HTTPClient/WiFiClientSecure, serta pustaka **Adafruit Fingerprint Sensor Library**. Kompatibilitas dengan unit fisik dan varian firmware AS608/R307 belum diuji.

1. Salin `secrets.example.h` ke `secrets.h` di folder sketch. Isi pin UART, Wi-Fi, domain HTTPS, CA sertifikat yang dipercaya, dan token yang sama dengan backend. `DEVICE_ID` hanya menggunakan huruf, angka, titik, garis bawah atau tanda hubung.
2. Hubungkan GND bersama. Silangkan TX sensor → RX papan dan RX sensor → TX papan. Periksa tegangan catu dan level logika pada datasheet modul yang dipakai sebelum menghubungkan. Gunakan penyesuai level bila diperlukan. Cek baud modul, default contoh 57600.
3. Buka Serial Monitor 115200 baud dan pilih akhiran baris newline. Jalankan `ENROLL 12` saat operator menyiapkan jari anggota pada perangkat lokal. Beberapa varian memakai kode respons berbeda untuk slot kosong. Jika perintah menolak slot kosong, gunakan prosedur enrollment bawaan sensor lalu tautkan nomor slot di portal. Template sidik jari disimpan oleh sensor. Backend menerima nomor slot.
4. Dari Panel Admin, tautkan ID slot itu ke profil anggota. Lepas jari sebelum pemindaian berikutnya. Monitor menampilkan hasil presensi; mode UI tersedia melalui portal.

Firmware mengirim heartbeat sekitar 30 detik saat sensor siap, memverifikasi sertifikat TLS, dan memakai UUID tetap saat mengulang satu scan. Antrean RAM menyimpan satu scan hingga 30 detik. Setelah koneksi kembali, ulangi pemindaian jika scan telah kedaluwarsa atau papan restart. Firmware tidak mengirim scan yang sudah kedaluwarsa.

- [Daftar profil Arduino Espressif](https://docs.espressif.com/projects/arduino-esp32/en/latest/getting_started.html)
- [Pustaka Adafruit Fingerprint](https://github.com/adafruit/Adafruit-Fingerprint-Sensor-Library)
