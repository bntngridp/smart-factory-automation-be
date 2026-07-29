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

  // 1. Group Monthly Production Yield
  const monthMap: Record<string, number> = {}
  productionLogs.forEach((log) => {
    if (!log.ProductionDate) return
    const month = new Date(log.ProductionDate).toLocaleString('en-US', { month: 'short' })
    monthMap[month] = (monthMap[month] || 0) + log.Quantity
  })

  const monthlyYield = Object.keys(monthMap).map((month) => ({
    month,
    output: monthMap[month],
    target: Math.round(monthMap[month] * 1.15),
  }))

  // Default months fallback if empty
  if (monthlyYield.length === 0) {
    const defaultMonths = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']
    defaultMonths.forEach((m) => {
      monthlyYield.push({ month: m, output: 1200, target: 1500 })
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
