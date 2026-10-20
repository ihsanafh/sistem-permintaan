# PRD: Sistem Permintaan Barang Internal

> **Instruksi untuk AI Agent (baca dulu):**
> Dokumen ini adalah blueprint proyek. Jangan menulis kode sebelum kamu:
> 1. Merangkum ulang pemahamanmu tentang arsitektur dan aturan bisnis di bawah ini.
> 2. Mengajukan pertanyaan untuk bagian yang ambigu (lihat Bagian 11: Keputusan Terbuka).
> 3. Mengusulkan rencana kerja per fase (Bagian 12) dan menunggu persetujuan saya.
>
> Kerjakan **satu fase per giliran**. Setelah tiap fase, jelaskan apa yang dibuat, cara menjalankannya, dan cara mengujinya. Jangan menambah fitur di luar dokumen ini tanpa bertanya.

---

## 1. Tujuan

Membangun sistem digital terintegrasi untuk menggantikan proses manual (kertas/lisan) dalam permintaan barang habis pakai (ATK, kebersihan) oleh pegawai.

Masalah yang diselesaikan:
- **Human error**: lupa mencatat, penerima tidak ada di tempat.
- **Race condition** pada pemotongan stok.
- **Tidak ada jejak audit** yang akurat untuk laporan bulanan.

## 2. Tech Stack

| Lapisan | Teknologi |
|---|---|
| Mobile (Pegawai & Petugas Antar) | React Native + **Expo**, build `.apk` (Android) untuk distribusi internal kantor |
| Web (Admin Gudang & Sistem) | **Next.js (App Router)** + React, deploy di **Vercel** |
| Excel di sisi browser | `xlsx` (SheetJS) atau `papaparse` untuk parsing dan export |
| Database | **Cloud Firestore** (NoSQL, real-time sync ke mobile) |
| Autentikasi | **Firebase Authentication** (Google Sign-In) |
| Otomatisasi | Vercel Cron **atau** Firebase Cloud Functions (job harian Auto-Confirm) |
| State & Data Fetching | **Zustand** untuk global state (hanya jika diperlukan) dan **React Query atau SWR** untuk data fetching dan caching, baik di Web maupun Mobile. Hindari Redux dan prop-drilling |

Catatan: pengembangan mobile memakai VS Code tanpa Android Studio (alur Expo).

## 3. Arsitektur Platform

- **Aplikasi Mobile**: dipakai pegawai untuk mengajukan permintaan dari mana saja, dan petugas antar untuk mencatat log pengantaran langsung di depan ruangan pegawai.
- **Aplikasi Web**: dibuka di browser laptop/PC oleh Admin Gudang. Layar lebar untuk analisis stok, persetujuan massal, dan pengelolaan file Excel.

## 4. Peran dan Hak Akses

| Peran | Platform | Kemampuan |
|---|---|---|
| **Pegawai** | Mobile | Mengajukan permintaan (barang stok 0 tidak dapat dipilih), melihat riwayat dan status, konfirmasi penerimaan, mengajukan sanggahan/keberatan |
| **Petugas Antar** | Mobile | Membawa barang ke ruangan pegawai dan mencatat log pengantaran: diterima, ditolak, atau pegawai tidak di tempat |
| **Admin Gudang & Sistem** | Web | Approve/Reject/Edit jumlah permintaan, kelola master barang, restock massal, audit stok fisik, tarik rekap bulanan |

## 5. Alur Permintaan Barang (Core Flow)

1. **Pengajuan**: pegawai memilih barang dan mengajukan request via mobile.
2. **Verifikasi**: admin memeriksa di dashboard web, lalu Approve / Reject / Edit Jumlah. Saat **Approve**, sistem memotong stok **secara atomik**. Status menjadi **"Disiapkan"**.
3. **Pengantaran**: petugas mengantar barang dan mencatat hasilnya dari HP ke database (`delivery_logs`).
4. **Konfirmasi**: pegawai menekan tombol **"Diterima"**.
5. **Auto-Confirm**: jika pegawai tidak menekan tombol dalam **2-3 hari**, cron job mengubah status menjadi **"Diterima (Otomatis)"**. Pegawai tetap berhak mengajukan sanggahan.
6. **Rekapitulasi**: akhir bulan, admin menarik data akumulasi per pegawai dari web untuk keperluan tanda tangan.

## 6. Manajemen Inventori dan Excel

Excel dibagi menjadi 3 fungsi terpisah demi keamanan dari race condition:

1. **Update Master Data (Excel)**
   - Hanya mengubah Nama Barang, Kategori, Satuan.
   - Sistem **mengabaikan / tidak menimpa kolom stok**, sehingga permintaan yang sedang berjalan tidak terganggu.
2. **Restock / Barang Masuk (Excel)**
   - Excel memiliki kolom khusus **"Penambahan Stok"**.
   - Saat upload, sistem memakai **Atomic Increment** Firestore (`FieldValue.increment`). Hanya menambah nilai ke stok terakhir di database.
3. **Stock Opname / Penyesuaian Fisik (UI Web khusus, bukan Excel)**
   - Halaman web berisi tabel; admin mengetik angka fisik aktual di gudang.
   - Sistem **menimpa** angka database dengan input ini dan mencatatnya sebagai tindakan audit.

## 7. Struktur Database Firestore

| Koleksi | Isi |
|---|---|
| `users` | Profil, **role** (pegawai/admin/petugas), divisi |
| `barang` | Katalog, stok real-time, kategori, status aktif/non-aktif |
| `permintaan` | Seluruh transaksi. Rincian barang disimpan sebagai **array di dalam dokumen**, beserta status, tanggal, catatan pengajuan |
| `delivery_logs` | Riwayat percobaan pengantaran (bisa beberapa kali, misal pegawai sedang rapat) |
| `riwayat_stok` | **Audit trail**: setiap perubahan stok. Merekam sumber (Permintaan Pegawai / Restock Excel / Stock Opname), besaran perubahan, waktu, dan identitas pelaku |

## 8. Aturan Bisnis Wajib (Non-negotiable)

- Pemotongan stok saat Approve **harus atomik** (Firestore transaction) dan memeriksa stok cukup sebelum dikurangi.
- **Setiap perubahan stok wajib menulis `riwayat_stok`** dalam transaksi yang sama.
- Upload Excel Master Data **tidak boleh menyentuh field stok**.
- Restock hanya boleh memakai increment, bukan menimpa nilai.
- Hanya Stock Opname yang boleh menimpa stok, dan wajib tercatat di audit.
- Barang dengan stok 0 tidak dapat dipilih pegawai.
- Auto-Confirm tidak menghilangkan hak sanggahan pegawai.
- **Pagination wajib**: selalu terapkan pagination, infinite scroll, atau limit (misal 20-50 dokumen per fetch) pada halaman riwayat permintaan dan riwayat stok untuk menghemat biaya Firestore Reads. Dilarang menarik seluruh koleksi sekaligus.
- **Validasi input ketat** di sisi Client **dan** Security Rules/Server: jumlah barang tidak boleh negatif, nol, desimal, atau berupa huruf (harus bilangan bulat positif).

## 9. Keamanan

- Firestore Security Rules per role (pegawai hanya baca/tulis permintaannya sendiri; petugas hanya menulis `delivery_logs`; admin akses penuh).
- Aksi sensitif (Approve, Restock, Stock Opname, Auto-Confirm) dijalankan di sisi server (Cloud Functions / API route), bukan langsung dari klien.

## 10. Di Luar Cakupan (Out of Scope)

Notifikasi push, integrasi sistem eksternal, dan fitur lain yang tidak disebut di dokumen ini. Tanyakan dulu sebelum menambahkan.

## 11. Keputusan Terbuka (Tanyakan ke saya, jangan berasumsi)

1. Jika pengantaran **ditolak/gagal** setelah stok terpotong, apakah stok dikembalikan otomatis? Jika ya, harus dicatat di `riwayat_stok`.
2. Perilaku Restock Excel: apa yang terjadi pada baris dengan barang tidak ditemukan, angka negatif, atau file yang diupload dua kali (perlu **idempotensi** agar stok tidak bertambah ganda)?
3. Perilaku persetujuan massal jika sebagian item stoknya tidak cukup (gagal semua atau sebagian)?
4. Format rekap bulanan (kolom, ekspor Excel/PDF) dan kebutuhan indeks komposit Firestore untuk query per pegawai per bulan.
5. Cara pembuatan akun dan penetapan role (siapa yang menjadi admin/petugas).
6. Pilihan cron: Vercel Cron atau Cloud Functions (perhatikan batasan paket gratis dan kebutuhan paket Blaze untuk Functions).

## 12. Rencana Fase yang Diusulkan

1. **Fondasi**: struktur repo (monorepo atau terpisah), setup Firebase, skema Firestore, Security Rules, autentikasi dan role.
2. **Web Admin**: master barang, restock Excel, update master Excel, Stock Opname.
3. **Mobile Pegawai**: katalog, pengajuan, riwayat, konfirmasi, sanggahan.
4. **Alur Approve**: transaksi atomik + `riwayat_stok`, pengantaran oleh petugas (mobile).
5. **Auto-Confirm** (cron) dan **rekap bulanan**.
6. **Pengujian dan distribusi**: uji race condition, build `.apk`, deploy Vercel.

Setelah membaca dokumen ini, balas dengan: (a) ringkasan pemahamanmu, (b) pertanyaan untuk Bagian 11, (c) rencana Fase 1 yang lebih rinci.
