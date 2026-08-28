import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'

function safeRevalidate(path: string) {
  try {
    revalidatePath(path)
  } catch {}
}

export type CreateMovementOutInput = {
  ProductID: number
  Quantity: number
}

type Movement = { MovementType: string | null; Quantity: number }

export async function getInventoryMovements(type?: string) {
  return prisma.inventoryMovements.findMany({
    where: type ? { MovementType: type } : undefined,
    orderBy: { MovementDate: 'desc' },
    include: { Products: { select: { ProductName: true, Unit: true } } },
  })
}

export async function getCurrentStock(productId: number): Promise<number> {
  const movements = await prisma.inventoryMovements.findMany({
    where: { ProductID: productId },
    select: { MovementType: true, Quantity: true },
  })

  const m = movements as Movement[]
  const totalIn = m.reduce(
    (sum, x) => (x.MovementType === 'IN' ? sum + x.Quantity : sum),
    0,
  )
  const totalOut = m.reduce(
    (sum, x) => (x.MovementType === 'OUT' ? sum + x.Quantity : sum),
    0,
  )

  return totalIn - totalOut
}

export const calculateProductStock = getCurrentStock

export async function createMovementOut(data: CreateMovementOutInput) {
  if (!data.Quantity || data.Quantity <= 0) {
    throw new Error('Jumlah stok keluar harus lebih besar dari 0')
  }

  const product = await prisma.products.findUnique({
    where: { ProductID: data.ProductID },
  })
  if (!product) {
    throw new Error(`Produk dengan ID ${data.ProductID} tidak ditemukan`)
  }

  const currentStock = await getCurrentStock(data.ProductID)

  if (currentStock < data.Quantity) {
    throw new Error(
      `Stok tidak mencukupi. Stok saat ini: ${currentStock}, diminta: ${data.Quantity}`,
    )
  }

  const movement = await prisma.inventoryMovements.create({
    data: {
      ProductID: data.ProductID,
      MovementType: 'OUT',
      Quantity: data.Quantity,
    },
  })

  safeRevalidate('/inventory/movements')
  safeRevalidate('/')
  return movement
}

export async function createStockOutMovement(productId: number, quantity: number) {
  return createMovementOut({ ProductID: productId, Quantity: quantity })
}
