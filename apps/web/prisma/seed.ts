import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaMssql } from '@prisma/adapter-mssql'
import bcrypt from 'bcryptjs'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set in environment variables')
}
const adapter = new PrismaMssql(connectionString)
const prisma = new PrismaClient({ adapter })

type LogRow = { ProductID: number; Quantity: number }

async function main() {
  console.log('🌱 [SEEDER] Memulai inisialisasi & pembersihan database...')

  // Bersihkan data transaksi dan master sebelum seeding
  await prisma.inventoryMovements.deleteMany()
  await prisma.productionLogs.deleteMany()
  await prisma.products.deleteMany()
  try {
    await prisma.users.deleteMany()
  } catch {
    console.log('ℹ️ Users table cleanup skipped')
  }

  // =========================================================================
  // 1. SEED AKUN PENGGUNA (5 AKUN DARI SETIAP ROLE, PASSWORD: password123)
  // =========================================================================
  console.log('🔐 [1/4] Meng-generate 20 akun terotentikasi (5 akun per role)...')
  const defaultPasswordHash = await bcrypt.hash('password123', 10)

  const roles = ['admin', 'supervisor', 'operator', 'warehouse'] as const
  const countWords = ['satu', 'dua', 'tiga', 'empat', 'lima']

  const usersData: { Username: string; Password: string; Role: string }[] = []

  for (const role of roles) {
    for (const word of countWords) {
      usersData.push({
        Username: `${role}${word}`,
        Password: defaultPasswordHash,
        Role: role,
      })
    }
  }

  for (const user of usersData) {
    await prisma.users.create({ data: user })
  }
  console.log(`✅ Berhasil membuat ${usersData.length} akun pengguna (${roles.join(', ')})!`)

  // =========================================================================
  // 2. SEED MASTER PRODUK (MINIMAL 10 PRODUK OTOMASI INDUSTRI)
  // =========================================================================
  console.log('📦 [2/4] Menambahkan data master produk industri...')
  const productsData = [
    { ProductName: 'Sensor Proximity Induktif M12', Unit: 'pcs', MinStock: 50 },
    { ProductName: 'PLC Siemens S7-1200 CPU 1214C', Unit: 'unit', MinStock: 10 },
    { ProductName: 'Motor Servo AC 750W + Driver', Unit: 'unit', MinStock: 15 },
    { ProductName: 'Pneumatic Cylinder DNC-50-100', Unit: 'pcs', MinStock: 25 },
    { ProductName: 'Industrial Power Supply 24V 10A', Unit: 'pcs', MinStock: 30 },
    { ProductName: 'Inverter VFD 3-Phase 2.2kW', Unit: 'unit', MinStock: 12 },
    { ProductName: 'Relay Solid State SSR 40A', Unit: 'pcs', MinStock: 80 },
    { ProductName: 'Flow Sensor Digital 1/2 Inch', Unit: 'pcs', MinStock: 20 },
    { ProductName: 'Bearing Precision SKF 6205-2RS', Unit: 'pcs', MinStock: 150 },
    { ProductName: 'Limit Switch Industri IP67', Unit: 'pcs', MinStock: 60 },
  ]

  const products = await prisma.$transaction(
    productsData.map((data) => prisma.products.create({ data })),
  )
  console.log(`✅ Berhasil membuat ${products.length} master produk`)

  // =========================================================================
  // 3. SEED LOG PRODUKSI (MINIMAL 10 LOG PRODUKSI DENGAN OPERATOR TERDAFTAR)
  // =========================================================================
  console.log('🏭 [3/4] Menambahkan riwayat log produksi...')
  const productionLogsData = [
    { ProductID: products[0].ProductID, Quantity: 250, OperatorName: 'operatorsatu' },
    { ProductID: products[0].ProductID, Quantity: 150, OperatorName: 'operatordua' },
    { ProductID: products[1].ProductID, Quantity: 18, OperatorName: 'operatortiga' },
    { ProductID: products[2].ProductID, Quantity: 30, OperatorName: 'operatorempat' },
    { ProductID: products[3].ProductID, Quantity: 75, OperatorName: 'operatorlima' },
    { ProductID: products[4].ProductID, Quantity: 120, OperatorName: 'operatorsatu' },
    { ProductID: products[5].ProductID, Quantity: 25, OperatorName: 'operatordua' },
    { ProductID: products[6].ProductID, Quantity: 200, OperatorName: 'operatortiga' },
    { ProductID: products[7].ProductID, Quantity: 45, OperatorName: 'operatorempat' },
    { ProductID: products[8].ProductID, Quantity: 500, OperatorName: 'operatorlima' },
    { ProductID: products[9].ProductID, Quantity: 180, OperatorName: 'operatorsatu' },
  ]

  const logs = (await prisma.$transaction(
    productionLogsData.map((data) => prisma.productionLogs.create({ data })),
  )) as LogRow[]
  console.log(`✅ Berhasil membuat ${logs.length} catatan log produksi`)

  // =========================================================================
  // 4. SEED MUTASI INVENTARIS (INFLOW & OUTFLOW REALISTIS)
  // =========================================================================
  console.log('🔄 [4/4] Menghitung dan menyinkronkan mutasi stok (IN & OUT)...')
  
  // Mutasi masuk (IN) otomatis dari hasil produksi
  const movementsIn = logs.map((log) => ({
    ProductID: log.ProductID,
    MovementType: 'IN',
    Quantity: log.Quantity,
  }))

  // Mutasi keluar (OUT) pengiriman & perakitan (kuantitas aman di bawah stok IN)
  const movementsOut = [
    { ProductID: products[0].ProductID, MovementType: 'OUT', Quantity: 80 },
    { ProductID: products[1].ProductID, MovementType: 'OUT', Quantity: 5 },
    { ProductID: products[2].ProductID, MovementType: 'OUT', Quantity: 8 },
    { ProductID: products[3].ProductID, MovementType: 'OUT', Quantity: 20 },
    { ProductID: products[4].ProductID, MovementType: 'OUT', Quantity: 35 },
    { ProductID: products[5].ProductID, MovementType: 'OUT', Quantity: 6 },
    { ProductID: products[6].ProductID, MovementType: 'OUT', Quantity: 50 },
    { ProductID: products[7].ProductID, MovementType: 'OUT', Quantity: 10 },
    { ProductID: products[8].ProductID, MovementType: 'OUT', Quantity: 120 },
    { ProductID: products[9].ProductID, MovementType: 'OUT', Quantity: 40 },
  ]

  const allMovements = [...movementsIn, ...movementsOut]

  await prisma.$transaction(
    allMovements.map((data) => prisma.inventoryMovements.create({ data })),
  )
  console.log(`✅ Berhasil membuat ${allMovements.length} mutasi stok (${movementsIn.length} IN, ${movementsOut.length} OUT)`)

  console.log('\n🎉 [SEEKER SUKSES] Seluruh data seeder berhasil diperbarui!')
  console.log('📊 Ringkasan Data Database:')
  console.log(`   • Users: ${usersData.length} Akun (Password: password123)`)
  console.log(`   • Products: ${products.length} Master Produk`)
  console.log(`   • Production Logs: ${logs.length} Catatan`)
  console.log(`   • Inventory Movements: ${allMovements.length} Mutasi`)
}

main()
  .catch((e) => {
    console.error('❌ Gagal melakukan seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
