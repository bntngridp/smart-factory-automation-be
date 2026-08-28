import { prisma } from '@/lib/db'

export type DashboardStats = {
  totalProducts: number
  todayProduction: number
  recentMovements: {
    MovementID: number
    ProductID: number
    MovementType: string | null
    Quantity: number
    MovementDate: Date | null
    ProductName: string
    Unit: string | null
  }[]
}

type MovementWithProduct = {
  MovementID: number
  ProductID: number
  MovementType: string | null
  Quantity: number
  MovementDate: Date | null
  Products: { ProductName: string; Unit: string | null }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const [totalProducts, todayAgg, recentMovements] = await Promise.all([
    prisma.products.count(),
    prisma.productionLogs.aggregate({
      _sum: { Quantity: true },
      where: { ProductionDate: { gte: startOfToday } },
    }),
    prisma.inventoryMovements.findMany({
      take: 5,
      orderBy: { MovementDate: 'desc' },
      include: { Products: { select: { ProductName: true, Unit: true } } },
    }),
  ])

  const movements = recentMovements as MovementWithProduct[]

  return {
    totalProducts,
    todayProduction: todayAgg._sum.Quantity ?? 0,
    recentMovements: movements.map((m) => ({
      MovementID: m.MovementID,
      ProductID: m.ProductID,
      MovementType: m.MovementType,
      Quantity: m.Quantity,
      MovementDate: m.MovementDate,
      ProductName: m.Products.ProductName,
      Unit: m.Products.Unit,
    })),
  }
}

export const getDashboardSummary = getDashboardStats
