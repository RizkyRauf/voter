# PRD – Aplikasi Voting Online

| | |
|---|---|
| **Versi** | 1.0 (Draft) |
| **Tanggal** | 15 Oktober 2026 |
| **Status** | Draft untuk review |
| **Platform** | Web App (Responsive: mobile, tablet, desktop) |

---

## 1. Ringkasan

Aplikasi voting sederhana di mana **admin** mendaftarkan daftar peserta (kandidat), lalu **pemilih (voter)** memilih **satu** peserta saja. Setelah admin menekan **Stop Vote**, voting ditutup dan hasil dinyatakan final.

## 2. Tujuan & Non-Tujuan

### Tujuan
- Admin dapat mengelola daftar peserta dengan mudah.
- Setiap pemilih hanya dapat memberikan **1 suara**.
- Admin dapat menghentikan voting dan melihat hasil akhir.
- Tampilan nyaman digunakan di HP, tablet, maupun desktop.

### Non-Tujuan (di luar scope v1)
- Multi-event / banyak sesi voting sekaligus.
- Voting berbobot atau pilih lebih dari satu.
- Integrasi pembayaran atau login sosial media.
- Aplikasi native (Android/iOS).

## 3. Peran Pengguna

| Peran | Deskripsi | Hak Akses |
|---|---|---|
| **Admin** | Penyelenggara voting | Kelola peserta, start/stop vote, lihat hasil, kelola pemilih |
| **Voter** | Pemilih | Melihat daftar peserta, memilih 1 peserta, melihat status suara |

## 4. Alur Utama (User Flow)

```
ADMIN                                   VOTER
  │                                       │
  ├─ Login                                │
  ├─ Tambah nama peserta                  │
  ├─ (Opsional) Buat kode/akses voter     │
  ├─ Klik "Mulai Vote"  ───────────────►  ├─ Buka link / masuk dengan kode
  │                                       ├─ Lihat daftar peserta
  │                                       ├─ Pilih 1 peserta
  │                                       ├─ Konfirmasi pilihan
  │                                       ├─ Suara tersimpan (tidak bisa ubah)
  ├─ Pantau jumlah suara masuk            │
  ├─ Klik "Stop Vote"  ─────────────────► ├─ Voting ditutup
  └─ Lihat hasil akhir                    └─ (Opsional) Lihat hasil
```

### Status Voting

| Status | Arti | Pemilih bisa vote? |
|---|---|---|
| `DRAFT` | Admin masih menyiapkan peserta | Tidak |
| `OPEN` | Voting berjalan | Ya (1x) |
| `CLOSED` | Admin menekan Stop Vote, hasil final | Tidak |

Perubahan status: `DRAFT → OPEN → CLOSED` (satu arah, tidak dapat dibuka kembali pada v1).

## 5. Kebutuhan Fungsional

### 5.1 Modul Admin

| ID | Kebutuhan | Prioritas |
|---|---|---|
| A-01 | Admin dapat login dengan username & password | Must |
| A-02 | Admin dapat menambah peserta (nama wajib; foto & deskripsi opsional) | Must |
| A-03 | Admin dapat mengedit dan menghapus peserta selama status `DRAFT` | Must |
| A-04 | Validasi: nama peserta tidak boleh kosong dan tidak boleh duplikat | Must |
| A-05 | Admin dapat menekan **Mulai Vote** (minimal 2 peserta) | Must |
| A-06 | Admin dapat melihat jumlah suara masuk secara real-time / refresh | Must |
| A-07 | Admin dapat menekan **Stop Vote** dengan dialog konfirmasi | Must |
| A-08 | Setelah Stop Vote, admin melihat hasil akhir (jumlah suara, persentase, pemenang) | Must |
| A-09 | Admin dapat mengelola pemilih (tambah/impor daftar, generate kode unik) | Should |
| A-10 | Admin dapat ekspor hasil ke CSV | Could |
| A-11 | Admin dapat mereset voting untuk sesi baru | Could |

### 5.2 Modul Voter

| ID | Kebutuhan | Prioritas |
|---|---|---|
| V-01 | Voter masuk melalui link voting (dan kode/identitas, lihat bagian 6) | Must |
| V-02 | Voter melihat daftar peserta yang sudah didaftarkan admin | Must |
| V-03 | Voter hanya dapat memilih **satu** peserta | Must |
| V-04 | Muncul dialog konfirmasi sebelum suara dikirim | Must |
| V-05 | Setelah memilih, voter tidak dapat memilih lagi maupun mengubah pilihan | Must |
| V-06 | Jika voting belum dimulai, tampil pesan "Voting belum dimulai" | Must |
| V-07 | Jika voting sudah ditutup, tampil pesan "Voting telah ditutup" | Must |
| V-08 | Halaman konfirmasi sukses setelah vote ("Terima kasih, suara Anda tercatat") | Must |
| V-09 | Voter dapat melihat hasil akhir setelah voting ditutup (dapat diatur admin) | Could |

## 6. Aturan "1 Voter = 1 Suara"

Ini adalah aturan inti dan harus ditegakkan di **server (backend)**, bukan hanya di tampilan.

**Opsi mekanisme identifikasi pemilih** (perlu diputuskan, lihat Open Questions):

| Opsi | Cara Kerja | Kelebihan | Kekurangan |
|---|---|---|---|
| **A. Kode unik (rekomendasi)** | Admin generate kode sekali pakai per pemilih | Paling akurat, sulit dicurangi | Admin perlu membagikan kode |
| B. Login akun voter | Voter daftar/login (email/nomor HP) | Identitas jelas | Lebih panjang bagi voter |
| C. Berbasis perangkat | Cookie/device fingerprint | Paling praktis, tanpa login | Mudah dicurangi (ganti browser/incognito) |

**Aturan umum:**
- Satu identitas pemilih hanya boleh memiliki **satu** record suara (unique constraint di database).
- Request kedua dari pemilih yang sama ditolak dengan pesan jelas.
- Suara hanya diterima saat status `OPEN`.

## 7. Kebutuhan Non-Fungsional

### 7.1 Responsive Design
- Pendekatan **mobile-first**.
- Breakpoint acuan:

| Perangkat | Lebar layar | Tata letak daftar peserta |
|---|---|---|
| Mobile | < 640 px | 1 kolom (kartu penuh lebar) |
| Tablet | 640 – 1024 px | 2 kolom |
| Desktop | > 1024 px | 3–4 kolom / tabel admin |

- Tombol & area sentuh minimal **44×44 px**.
- Teks terbaca tanpa zoom; tidak ada scroll horizontal.
- Dashboard admin: tabel berubah menjadi tampilan kartu di layar kecil.
- Dapat diuji di Chrome, Safari, Firefox, Edge (versi terbaru) dan iOS/Android browser.

### 7.2 Performa
- Halaman termuat < 3 detik pada koneksi 4G.
- Mampu menangani minimal **500 pemilih** vote bersamaan (dapat disesuaikan).

### 7.3 Keamanan
- Password admin di-hash (bcrypt/argon2).
- Semua trafik via HTTPS.
- Rute admin dilindungi autentikasi & otorisasi.
- Perlindungan dasar: rate limiting, validasi input, proteksi CSRF/XSS.
- Pencegahan double submit (disable tombol setelah klik + pengecekan server).

### 7.4 Integritas & Kerahasiaan
- Suara tidak dapat diubah/dihapus setelah tercatat.
- Admin tidak dapat mengubah peserta saat voting `OPEN`.
- Setelah `CLOSED`, data suara bersifat final (read-only).
- Kerahasiaan: hasil per pemilih tidak ditampilkan; hanya agregat (kecuali kebutuhan audit diputuskan lain).

### 7.5 Aksesibilitas
- Kontras warna memadai (WCAG AA), label form jelas, dapat dinavigasi dengan keyboard.

## 8. Gambaran Layar (Wireframe Teks)

### 8.1 Voter – Mobile
```
┌───────────────────────┐
│  Pemilihan [Judul]    │
│  Pilih satu peserta   │
├───────────────────────┤
│ ( ) 👤 Nama Peserta 1 │
│ ( ) 👤 Nama Peserta 2 │
│ ( ) 👤 Nama Peserta 3 │
├───────────────────────┤
│   [  Kirim Suara  ]   │
└───────────────────────┘
```

### 8.2 Admin – Dashboard
```
┌──────────────────────────────────────────┐
│ Status: OPEN        Suara masuk: 128     │
├──────────────────────────────────────────┤
│ Peserta        │ Suara │ %               │
│ Nama 1         │  60   │ 47%             │
│ Nama 2         │  45   │ 35%             │
│ Nama 3         │  23   │ 18%             │
├──────────────────────────────────────────┤
│ [+ Tambah Peserta]        [ STOP VOTE ]  │
└──────────────────────────────────────────┘
```

## 9. Model Data (Usulan)

| Tabel | Kolom Utama |
|---|---|
| `admins` | id, username, password_hash, created_at |
| `elections` | id, title, status (`DRAFT`/`OPEN`/`CLOSED`), started_at, closed_at |
| `candidates` | id, election_id, name, photo_url, description |
| `voters` | id, election_id, code/identifier, has_voted |
| `votes` | id, election_id, voter_id (**UNIQUE**), candidate_id, created_at |

## 10. Kriteria Penerimaan (Acceptance Criteria)

1. **Given** voting berstatus `OPEN` dan voter belum memilih, **when** voter memilih satu peserta dan konfirmasi, **then** suara tersimpan dan voter melihat halaman sukses.
2. **Given** voter sudah memilih, **when** mencoba memilih lagi (termasuk lewat refresh/API langsung), **then** sistem menolak.
3. **Given** admin menekan Stop Vote dan konfirmasi, **then** status menjadi `CLOSED`, voter baru tidak dapat memilih, dan hasil akhir tampil.
4. **Given** status `DRAFT` atau `CLOSED`, **when** voter membuka halaman voting, **then** tombol vote tidak tersedia dan pesan status tampil.
5. **Given** layar 360 px, 768 px, dan 1280 px, **then** seluruh halaman tampil rapi tanpa scroll horizontal dan semua tombol dapat digunakan.
6. **Given** admin mencoba memulai voting dengan < 2 peserta, **then** sistem menolak dengan pesan validasi.

## 11. Metrik Keberhasilan

- 100% pemilih sah hanya memiliki maksimal 1 suara (tanpa duplikasi).
- Tingkat keberhasilan submit suara ≥ 99%.
- Tidak ada keluhan layout rusak pada perangkat mobile utama.
- Admin dapat menyelesaikan siklus penuh (tambah peserta → mulai → stop → lihat hasil) tanpa panduan tambahan.

## 12. Rekomendasi Teknologi (Opsional)

| Lapisan | Contoh |
|---|---|
| Frontend | React / Next.js / Vue + Tailwind CSS (responsive) |
| Backend | Node.js (Express/NestJS), Laravel, atau Django |
| Database | PostgreSQL / MySQL |
| Hosting | Vercel / VPS / Cloud Run |

## 13. Rencana Rilis

| Fase | Cakupan |
|---|---|
| **MVP (v1.0)** | Login admin, kelola peserta, start/stop vote, voting 1 suara per pemilih, hasil akhir, responsive |
| **v1.1** | Kode pemilih massal, ekspor CSV, foto peserta |
| **v2.0** | Multi-event, jadwal otomatis start/stop, audit log, reset/sesi baru |

## 14. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Pemilih curang (vote ganda) | Hasil tidak valid | Kode unik sekali pakai + unique constraint di database |
| Lonjakan trafik saat vote | Aplikasi lambat/down | Optimasi query, caching, load testing |
| Admin salah klik Stop Vote | Voting berhenti prematur | Dialog konfirmasi dua langkah |
| Tampilan rusak di perangkat tertentu | Pengalaman buruk | Uji di berbagai ukuran layar & browser |

## 15. Open Questions (Perlu Keputusan)

1. Bagaimana pemilih diidentifikasi: **kode unik**, **login**, atau **berbasis perangkat**?
2. Apakah voter boleh melihat **hasil** setelah voting ditutup, atau hanya admin?
3. Apakah hasil ditampilkan **real-time** selama voting, atau disembunyikan sampai `CLOSED`?
4. Apakah suara bersifat **anonim penuh**, atau admin perlu tahu siapa memilih siapa (audit)?
5. Apakah dibutuhkan **lebih dari satu sesi voting** (multi-event) pada versi awal?
6. Apakah peserta perlu **foto dan deskripsi**, atau cukup nama?
7. Apakah **Stop Vote** dapat dibatalkan (dibuka kembali) atau final?

---

## 16. Amendmen (perubahan keputusan setelah v1)

Keputusan berikut menggantikan bagian PRD yang bertentangan dan sudah
diimplementasikan:

### Amd. 1 — Identifikasi pemilih: nama, bukan kode (mengganti bagian 6 & OQ 1)

- Sistem kode unik sekali pakai **dihapus**. Pemilih mendaftar dengan
  **nama** saat membuka halaman voting; nama disimpan dan sesi diberikan lewat
  cookie.
- **Satu nama = satu suara.** Nama dinormalisasi (trim, spasi rapat, huruf
  besar/kecil diabaikan), sehingga "Budi", " budi " dianggap orang yang sama
  dan hanya boleh memilih sekali (dicegah di server, bukan hanya tampilan).
- Nama yang mirip tapi tidak identik ("Budi" vs "Budi Santoso") diperbolehkan
  sebagai entri terpisah; admin membersihkan lewat tabel pemilih.
- Pilihan pemilih **tetap anonim**. Tabel admin hanya menampilkan
  `nama · sudah/belum memilih · waktu`, tanpa kandidat yang dipilih.

### Amd. 2 — Tabel pemilih & hapus entri (fitur baru)

- Admin melihat tabel pemilih yang diperbarui otomatis saat voting berjalan.
- Admin dapat **menghapus nama kapan saja** (untuk membersihkan nama aneh /
  ganda). Penghapusan bersifat kaskade: suara yang pernah diberikan ikut
  dihapus dari total hasil, dan nama tersebut dapat mendaftar-ulang.
- Reset sesi baru menghapus **semua suara dan daftar nama pemilih**
  (bersih total); daftar peserta tetap dipertahankan, dan nama yang sama
  boleh didaftarkan-ulang di sesi baru.

### Amd. 3 — Keputusan lain yang sudah final (menjawab OQ)

- **OQ 2:** voter boleh melihat hasil **setelah `CLOSED`**, dapat dimatikan
  admin (`showResultsToVoters`, default aktif).
- **OQ 3:** hasil tersembunyi selama `OPEN` (hanya admin yang melihat live
  count); final setelah `CLOSED`.
- **OQ 4:** suara **anonim penuh** terhadap admin (lihat Amd. 1).
- **OQ 5:** **satu event** saja di v1.
- **OQ 6:** peserta boleh punya **foto & deskripsi** (opsional).
- **OQ 7:** Stop Vote **final** (satu arah; `DRAFT → OPEN → CLOSED`). Untuk
  sesi berikutnya admin memakai "Reset Sesi Baru".