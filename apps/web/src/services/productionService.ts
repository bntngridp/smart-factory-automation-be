import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'

function safeRevalidate(path: string) {
  try {
    revalidatePath(path)
  } catch {}
}

export type CreateProductionLogInput = {
  ProductID: number
  Quantity: number
  OperatorName: string
}

export async function getProductionLogs(limit = 20) {
  return prisma.productionLogs.findMany({
    take: limit,
    orderBy: { ProductionDate: 'desc' },
    include: { Products: { select: { ProductName: true, Unit: true } } },
  })
}

export async function createProductionLog(data: CreateProductionLogInput) {
  if (!data.ProductID || data.ProductID <= 0) {
    throw new Error('Produk harus dipilih')
  }
  if (!data.Quantity || data.Quantity <= 0) {
    throw new Error('Jumlah produksi harus lebih besar dari 0')
  }
  if (!data.OperatorName || data.OperatorName.trim() === '') {
    throw new Error('Nama operator tidak boleh kosong')
  }

  const product = await prisma.products.findUnique({
    where: { ProductID: data.ProductID },
  })
  if (!product) {
    throw new Error(`Produk dengan ID ${data.ProductID} tidak ditemukan`)
  }

  const result = await prisma.$transaction(async (tx) => {
    const log = await tx.productionLogs.create({
      data: {
        ProductID: data.ProductID,
        Quantity: data.Quantity,
        OperatorName: data.OperatorName.trim(),
      },
    })

    await tx.inventoryMovements.create({
      data: {
        ProductID: data.ProductID,
        MovementType: 'IN',
        Quantity: data.Quantity,
      },
    })

    return log
  })

  safeRevalidate('/production-logs')
  safeRevalidate('/')
  safeRevalidate('/products')
  return result
}
