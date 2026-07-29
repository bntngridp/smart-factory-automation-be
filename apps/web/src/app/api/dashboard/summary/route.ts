import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:6061',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  })
}

type Movement = { MovementType: string | null; Quantity: number }

type ProductWithMovements = {
  ProductID: number
  ProductName: string
  Unit: string | null
  MinStock: number | null
  InventoryMovements: Movement[]
}

export async function GET() {
  try {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const [totalProducts, todayAgg, products] = await Promise.all([
      prisma.products.count(),
      prisma.productionLogs.aggregate({
        _sum: { Quantity: true },
        where: { ProductionDate: { gte: startOfToday } },
      }),
      prisma.products.findMany({
        where: { MinStock: { gt: 0 } },
        include: {
          InventoryMovements: { select: { MovementType: true, Quantity: true } },
        },
      }),
    ])

    const list = products as ProductWithMovements[]

    const lowStockAlerts = list
      .map((product) => {
        const totalIn = product.InventoryMovements.reduce(
          (sum, m) => (m.MovementType === 'IN' ? sum + m.Quantity : sum),
          0,
        )
        const totalOut = product.InventoryMovements.reduce(
          (sum, m) => (m.MovementType === 'OUT' ? sum + m.Quantity : sum),
          0,
        )
        const currentStock = totalIn - totalOut
        const minStock = product.MinStock ?? 0

        return {
          ProductID: product.ProductID,
          ProductName: product.ProductName,
          Unit: product.Unit,
          MinStock: minStock,
          CurrentStock: currentStock,
        }
      })
      .filter((p) => p.CurrentStock < p.MinStock)

    return NextResponse.json(
      {
        total_products: totalProducts,
        total_production_today: todayAgg._sum.Quantity ?? 0,
        low_stock_alerts: lowStockAlerts,
      },
      { status: 200, headers: corsHeaders },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}
