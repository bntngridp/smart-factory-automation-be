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
  console.log('🌱 Memulai seeding database...')

  await prisma.inventoryMovements.deleteMany()
  await prisma.productionLogs.deleteMany()
  await prisma.products.deleteMany()
  try {
    // @ts-expect-error users model might not be generated in all environments
    await prisma.users.deleteMany()
  } catch {
    console.log('Users table might not exist yet during initial clean, skipping deleteMany')
  }

  // Seed user admin & adminsatu s/d admintiga
  const defaultPassword = await bcrypt.hash('password123', 10)
  const legacyPassword = await bcrypt.hash('admin123', 10)

  const adminUsersData = [
    { Username: 'admin', Password: legacyPassword, Role: 'admin' },
    { Username: 'adminsatu', Password: defaultPassword, Role: 'admin' },
    { Username: 'admindua', Password: defaultPassword, Role: 'admin' },
    { Username: 'admintiga', Password: defaultPassword, Role: 'admin' },
  ]

  for (const u of adminUsersData) {
    // @ts-expect-error users model might not be generated in all environments
    await prisma.users.create({ data: u })
  }
  console.log('✅ User adminsatu, admindua, admintiga & admin berhasil dibuat!')

  const productsData = [
    { ProductName: 'Baut Industri M8', Unit: 'pcs', MinStock: 500 },
    { ProductName: 'Sensor Suhu OMRON E5CC', Unit: 'pcs', MinStock: 25 },
    { ProductName: 'PLC Mitsubishi FX5U', Unit: 'unit', MinStock: 10 },
    { ProductName: 'Motor Servo 400W', Unit: 'unit', MinStock: 15 },
    { ProductName: 'Relay Industri 24V', Unit: 'pcs', MinStock: 100 },
    { ProductName: 'Bearing SKF 6203', Unit: 'pcs', MinStock: 200 },
  ]

  const products = await prisma.$transaction(
    productsData.map((data) => prisma.products.create({ data })),
  )
  console.log(`✅ ${products.length} produk berhasil dibuat`)

  const productionLogsData = [
    { ProductID: products[0].ProductID, Quantity: 500, OperatorName: 'Budi Santoso' },
    { ProductID: products[0].ProductID, Quantity: 350, OperatorName: 'Siti Aminah' },
    { ProductID: products[1].ProductID, Quantity: 40, OperatorName: 'Andi Wijaya' },
    { ProductID: products[2].ProductID, Quantity: 12, OperatorName: 'Dewi Lestari' },
    { ProductID: products[3].ProductID, Quantity: 25, OperatorName: 'Rudi Hartono' },
    { ProductID: products[4].ProductID, Quantity: 200, OperatorName: 'Maya Sari' },
  ]

  const logs = (await prisma.$transaction(
    productionLogsData.map((data) => prisma.productionLogs.create({ data })),
  )) as LogRow[]
  console.log(`✅ ${logs.length} production log berhasil dibuat`)

  const inventoryMovementsData = logs.map((log) => ({
    ProductID: log.ProductID,
    MovementType: 'IN',
    Quantity: log.Quantity,
  }))

  await prisma.$transaction(
    inventoryMovementsData.map((data) => prisma.inventoryMovements.create({ data })),
  )
  console.log(`✅ ${inventoryMovementsData.length} inventory movement berhasil dibuat`)

  console.log('🎉 Seeding selesai!')
}

main()
  .catch((e) => {
    console.error('❌ Gagal melakukan seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
