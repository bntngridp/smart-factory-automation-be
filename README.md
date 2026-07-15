# Smart Factory Automation BE

Sistem Backend (API-Only) berbasis Next.js untuk otomasi, pencatatan produksi harian, dan monitoring inventaris pabrik pintar secara real-time. Sistem ini terintegrasi dengan database **Microsoft SQL Server (MSSQL)** via **Prisma ORM**.

---

## 🛠️ Tech Stack & Arsitektur

- **Runtime & Framework:** Node.js & Next.js 16 (API Routes Only)
- **Database ORM:** Prisma ORM
- **Database Engine:** Microsoft SQL Server (MSSQL)
- **Autentikasi:** JWT session token via `jose` (httpOnly cookies) & `bcryptjs`
- **Validasi Data:** Zod

---

## 📡 REST API Endpoints

Semua endpoint selain login/logout membutuhkan cookie session yang valid (`session`). Jika tidak terautentikasi, API akan mengembalikan `401 Unauthorized`.

### 🔐 Autentikasi
- **`POST /api/auth/login`**:
  - Request body: `{ "username": "admin", "password": "admin123" }`
  - Response: Set cookie session `session` + JSON info user.
- **`POST /api/auth/logout`**:
  - Response: Clear session cookie.
- **`GET /api/auth/me`**:
  - Response: Mengembalikan informasi session user saat ini `{ Username, Role }`.

### 📦 Master Produk
- **`GET /api/products`**:
  - Mengambil semua daftar produk di pabrik. Mendukung filter pencarian via query parameter (contoh: `?search=Sensor`).
- **`POST /api/products`**:
  - Menambahkan produk baru.
  - Body: `{ "ProductName": "Sensor OMRON", "Unit": "pcs", "MinStock": 20 }`

### 📝 Log Produksi
- **`POST /api/production-logs`**:
  - Mencatat hasil produksi operator harian.
  - Body: `{ "product_id": 1, "quantity": 100, "operator_name": "Budi" }`
  - **Atomik Side-effect:** Secara otomatis memicu transaksi database untuk menambahkan stok di inventaris (`IN` movement).

### 🔄 Pergerakan Inventaris
- **`GET /api/inventory/movements`**:
  - Melihat riwayat pergerakan keluar/masuk stok. Mendukung filter tipe (contoh: `?type=IN` atau `?type=OUT`).
- **`POST /api/inventory/movements`**:
  - Mencatat pengeluaran stok secara manual (`OUT` movement).
  - Body: `{ "product_id": 1, "quantity": 10, "movement_type": "OUT" }`
  - **Validasi:** Melakukan verifikasi stok real-time. Jika stok tidak cukup, mengembalikan status `422 Unprocessable Entity`.

### 📊 Dashboard Summary
- **`GET /api/dashboard/summary`**:
  - Mengambil statistik ringkas: total produk, jumlah produksi hari ini, dan peringatan stok menipis (`low_stock_alerts`).

---

## 🚀 Panduan Setup & Uji Coba

### 1. Prasyarat (Prerequisites)
Pastikan Docker dan Node.js sudah terinstall di sistem Anda.

### 2. Jalankan Database SQL Server (Docker)
```bash
docker start sql_server
```

### 3. Setup Environment Variables
Buat file `apps/web/.env` dengan konten berikut:
```env
DATABASE_URL="sqlserver://localhost:1433;database=InventoryDB;user=sa;password=<YOUR_PASSWORD>;encrypt=true;trustServerCertificate=true;"
JWT_SECRET="dubu-secret-eagle-eye-key-shh"
```

### 4. Instalasi Dependency & Seed Database
Pindah ke direktori `apps/web/`:
```bash
npm install
npx prisma db push
npx prisma generate
npx prisma db seed
```

### 5. Jalankan Aplikasi (API Server)
```bash
npm run dev
```
Server backend akan berjalan di [http://localhost:3000](http://localhost:3000). Mengakses root path `/` akan dialihkan secara otomatis ke `/api/dashboard/summary`.

### 6. Jalankan Integration Tests
Untuk menjalankan automated testing API:
```bash
npm run test:api
```
All tests should pass.
