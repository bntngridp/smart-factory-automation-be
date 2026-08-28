import 'server-only'
import { prisma } from '@/lib/db'

export async function getReportsAnalytics() {
  const [productionLogs, products, movements] = await Promise.all([
    prisma.productionLogs.findMany({
      orderBy: { ProductionDate: 'asc' },
      include: { Products: { select: { ProductName: true, Unit: true } } },
    }),
    prisma.products.findMany({
      include: {
        InventoryMovements: { select: { MovementType: true, Quantity: true } },
      },
    }),
    prisma.inventoryMovements.findMany({
      orderBy: { MovementDate: 'asc' },
      include: { Products: { select: { ProductName: true } } },
    }),
  ])

  // 1. Group Monthly Production Yield (Last 6 Months)
  const now = new Date()
  const monthlyYield = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthKey = d.toLocaleString('en-US', { month: 'short' })
    const yearMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

    const monthTotal = productionLogs
      .filter((log) => {
        if (!log.ProductionDate) return false
        const logDate = new Date(log.ProductionDate)
        const logYM = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}`
        return logYM === yearMonthStr
      })
      .reduce((sum, log) => sum + log.Quantity, 0)

    monthlyYield.push({
      month: monthKey,
      output: monthTotal,
      target: monthTotal > 0 ? Math.round(monthTotal * 1.2) : 500,
    })
  }

  // 2. Group Top Products Distribution
  const productVolumeMap: Record<string, number> = {}
  productionLogs.forEach((log) => {
    const name = log.Products?.ProductName || `Product #${log.ProductID}`
    productVolumeMap[name] = (productVolumeMap[name] || 0) + log.Quantity
  })

  const topProducts = Object.keys(productVolumeMap).map((name) => ({
    name,
    volume: productVolumeMap[name],
  }))

  // 3. Current Stock Overview per Product
  const productStockSummary = products.map((p) => {
    const totalIn = p.InventoryMovements.reduce(
      (sum, m) => (m.MovementType === 'IN' ? sum + m.Quantity : sum),
      0,
    )
    const totalOut = p.InventoryMovements.reduce(
      (sum, m) => (m.MovementType === 'OUT' ? sum + m.Quantity : sum),
      0,
    )
    return {
      ProductID: p.ProductID,
      ProductName: p.ProductName,
      Unit: p.Unit,
      CurrentStock: totalIn - totalOut,
      MinStock: p.MinStock ?? 0,
    }
  })

  return {
    monthly_yield: monthlyYield,
    top_products: topProducts,
    product_stocks: productStockSummary,
    total_logs_count: productionLogs.length,
    total_movements_count: movements.length,
  }
}
