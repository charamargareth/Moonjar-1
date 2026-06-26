# Moonjar 🌙 — Tabungan Bersama

PWA (Progressive Web App) untuk nabung bareng teman/keluarga. Bisa di-install ke
home screen HP Android & iOS langsung dari browser, tanpa perlu Play Store.

## Struktur folder

```
moonjar/
├── index.html              # Halaman utama (shell PWA)
├── manifest.json            # Konfigurasi PWA (nama, icon, warna)
├── service-worker.js         # Cache offline app shell
├── css/
│   ├── variables.css         # Token desain (warna, font, spacing)
│   ├── auth.css               # Style login/register/onboarding
│   └── app.css                # Style halaman utama (home/history/target/group)
├── js/
│   ├── supabase-client.js     # ⚠️ ISI URL & KEY SUPABASE DI SINI
│   ├── auth.js                  # Login, register, logout
│   ├── state.js                 # Query database, realtime, kalkulasi
│   ├── ai-tip-local.js           # Saran nabung lokal (gratis, default aktif)
│   ├── charts.js                 # Canvas bintang & bar chart
│   ├── helpers.js                 # Format Rupiah, tanggal, toast
│   ├── icons.js                    # Ikon SVG inline
│   ├── ui-auth.js                   # Render halaman login/onboarding
│   ├── ui-app.js                      # Render 4 halaman utama
│   └── app.js                          # Entry point & routing
├── icons/                     # Icon PWA (sudah digenerate, boleh diganti)
└── supabase/
    ├── migrations/001_init.sql    # Skema database — jalankan di Supabase
    └── functions/ai-tip/index.ts   # Edge Function untuk saran AI
```

## Setup dari nol (estimasi 15 menit)

### 1. Buat project Supabase (gratis)
1. Daftar di https://supabase.com → "New Project"
2. Tunggu project selesai dibuat (~2 menit)
3. Buka **Project Settings → API** → catat:
   - `Project URL`
   - `anon public` key

### 2. Jalankan skema database
1. Buka **SQL Editor** di dashboard Supabase
2. Copy-paste seluruh isi `supabase/migrations/001_init.sql`
3. Klik **Run**

Ini akan membuat semua tabel (`profiles`, `groups`, `group_members`,
`transactions`, `ai_tips`) beserta Row Level Security agar tiap user hanya
bisa lihat data grupnya sendiri.

### 3. Isi kredensial di kode
Buka `js/supabase-client.js`, ganti baris ini:

```js
const SUPABASE_URL = "https://YOUR-PROJECT-ID.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";
```

dengan nilai dari langkah 1.

### 4. Saran nabung — sudah aktif otomatis, gratis, tanpa setup

Bagian "saran moonjar" di home & target page sudah jalan otomatis pakai
**kalkulasi lokal** (lihat `js/ai-tip-local.js`) — dihitung dari data asli
grup kamu (sisa target, durasi, jumlah anggota, kapan terakhir nabung), lalu
dirangkai jadi kalimat dengan variasi template biar gak monoton. Tidak butuh
API key, tidak ada biaya, dan respons-nya instan karena tidak ada panggilan
ke server luar.

> **Mau upgrade ke AI generative (Claude API) suatu saat nanti?**
> Sudah disiapkan jalurnya di `supabase/functions/ai-tip/index.ts`. Caranya:
> 1. Deploy Edge Function-nya:
>    ```bash
>    npm install -g supabase
>    supabase login
>    supabase link --project-ref YOUR-PROJECT-ID
>    supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
>    supabase functions deploy ai-tip
>    ```
> 2. Di `js/state.js`, fungsi `requestAiTipFromEdgeFunction` sudah siap pakai.
>    Buka `js/ui-app.js`, di bagian `import { ... requestAiTip ... } from "./state.js"`,
>    ganti jadi `requestAiTipFromEdgeFunction as requestAiTip`.
>
> API Anthropic ini berbayar per pemakaian (beda dari akun Claude.ai biasa),
> walau biayanya kecil untuk skala personal. Kalau gak butuh saran yang
> "ditulis ulang" gaya AI generatif, versi lokal di atas sudah cukup pintar
> dan tetap personal karena tetap pakai angka asli grup kamu.

### 5. (Opsional) Aktifkan login Google
Kalau mau tombol "Masuk dengan Google" berfungsi:
1. Supabase Dashboard → **Authentication → Providers → Google**
2. Ikuti instruksi untuk dapat Client ID/Secret dari Google Cloud Console
3. Masukkan ke Supabase, aktifkan toggle

Kalau di-skip, login email/password tetap berfungsi normal.

### 6. Coba lokal dulu
Karena pakai ES Modules (`type="module"`), file `index.html` **tidak bisa**
dibuka langsung dengan double-click (`file://`) — harus lewat server lokal:

```bash
cd moonjar
python3 -m http.server 8000
# lalu buka http://localhost:8000 di browser
```

Atau pakai VS Code extension **Live Server**.

### 7. Deploy ke hosting gratis (biar bisa dites di HP)
Paling simpel: **Netlify Drop** (drag & drop folder, persis seperti cara kamu
hosting monthsary card kemarin).

1. Buka https://app.netlify.com/drop
2. Drag seluruh folder `moonjar` ke browser
3. Dapat link `https://nama-acak.netlify.app`
4. Buka link itu di HP → menu browser → **"Add to Home Screen"** / **"Install app"**

Selesai — icon Moonjar akan muncul di home screen HP seperti app biasa.

## Cara pakai di app

1. **Daftar** akun (nama, email, password)
2. Pilih **buat grup baru** (jadi admin, dapat kode undangan 6 karakter) atau
   **gabung grup** pakai kode dari temanmu
3. Kalau bikin grup baru: bagikan kode undangan ke anggota lain supaya mereka
   bisa join dan datanya otomatis sinkron real-time
4. Tap tombol **+** (floating button) untuk catat tabungan baru
5. Tab **Target** untuk atur/ubah target & lihat rencana nabung per orang
6. Tab **Group** untuk lihat anggota, kontribusi tiap orang, dan leaderboard

## Catatan teknis

- **Realtime:** transaksi baru dari anggota lain otomatis muncul tanpa
  refresh, lewat Supabase Realtime (Postgres logical replication).
- **Keamanan:** semua akses data dibatasi Row Level Security — user A tidak
  bisa baca/tulis data grup yang bukan miliknya, bahkan kalau tahu ID-nya.
- **Offline:** app shell (HTML/CSS/JS/icon) di-cache oleh service worker
  sehingga app tetap bisa dibuka tanpa internet, tapi data tabungan tetap
  butuh koneksi karena disimpan di server (by design, agar selalu sinkron).
- **Upgrade ke APK asli nanti:** kalau suatu saat mau publish ke Play Store,
  project ini bisa di-wrap pakai [Capacitor](https://capacitorjs.com) tanpa
  menulis ulang kode — tinggal `npx cap init` lalu `npx cap add android` di
  folder ini.

## Mengganti icon PWA

Icon di `icons/` sekarang adalah placeholder bulan sederhana yang otomatis
digenerate. Kalau Kara punya desain logo sendiri, ganti 3 file ini (ukuran
harus sama persis):
- `icon-192.png` (192×192)
- `icon-512.png` (512×512)
- `icon-maskable-512.png` (512×512, dengan padding aman di tengah ~20%
  karena Android akan crop jadi bentuk lain seperti lingkaran/squircle)
