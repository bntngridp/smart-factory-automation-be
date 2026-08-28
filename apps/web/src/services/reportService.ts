import { prisma } from '@/lib/db'

export async function getReportsAnalytics(days: number = 30) {
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

  const now = new Date()
  const monthlyYield: Array<{ month: string; output: number; target: number }> = []

  // 1. Group Yield Based on Selected Timeframe (7 days, 30 days, or 90 days)
  if (days === 7) {
    // Daily intervals for the last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const label = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })

      const dayTotal = productionLogs
        .filter((log) => {
          if (!log.ProductionDate) return false
          const logDateStr = new Date(log.ProductionDate).toISOString().split('T')[0]
          return logDateStr === dateStr
        })
        .reduce((sum, log) => sum + log.Quantity, 0)

      monthlyYield.push({
        month: label,
        output: dayTotal,
        target: dayTotal > 0 ? Math.round(dayTotal * 1.2) : 250,
      })
    }
  } else if (days === 90) {
    // 3 Months intervals
    for (let i = 2; i >= 0; i--) {
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
        target: monthTotal > 0 ? Math.round(monthTotal * 1.2) : 1000,
      })
    }
  } else {
    // Default: 30 Days (4 Weekly Intervals)
    for (let w = 3; w >= 0; w--) {
      const startDaysAgo = (w + 1) * 7
      const endDaysAgo = w * 7
      const startDate = new Date(now)
      startDate.setDate(now.getDate() - startDaysAgo)
      startDate.setHours(0, 0, 0, 0)

      const endDate = new Date(now)
      endDate.setDate(now.getDate() - endDaysAgo)
      endDate.setHours(23, 59, 59, 999)

      const weekLabel = `Wk ${4 - w}`

      const weekTotal = productionLogs
        .filter((log) => {
          if (!log.ProductionDate) return false
          const logDate = new Date(log.ProductionDate)
          return logDate >= startDate && logDate <= endDate
        })
        .reduce((sum, log) => sum + log.Quantity, 0)

      monthlyYield.push({
        month: weekLabel,
        output: weekTotal,
        target: weekTotal > 0 ? Math.round(weekTotal * 1.2) : 600,
      })
    }
  }

  // 2. Group Top Products Distribution filtered by timeframe
  const cutoffDate = new Date(now)
  cutoffDate.setDate(cutoffDate.getDate() - days)
  cutoffDate.setHours(0, 0, 0, 0)

  const filteredLogs = productionLogs.filter((log) => {
    if (!log.ProductionDate) return false
    return new Date(log.ProductionDate) >= cutoffDate
  })

  // Fallback to all logs if no logs in timeframe to maintain clean charts
  const logsForProducts = filteredLogs.length > 0 ? filteredLogs : productionLogs

  const productVolumeMap: Record<string, number> = {}
  logsForProducts.forEach((log) => {
    const name = log.Products?.ProductName || `Product #${log.ProductID}`
    productVolumeMap[name] = (productVolumeMap[name] || 0) + log.Quantity
  })

  const topProducts = Object.keys(productVolumeMap)
    .map((name) => ({
      name,
      volume: productVolumeMap[name],
    }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 6)

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
    total_logs_count: filteredLogs.length > 0 ? filteredLogs.length : productionLogs.length,
    total_movements_count: movements.length,
  }
}
