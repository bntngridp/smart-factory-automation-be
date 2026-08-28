import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { getDashboardSummary } from '../../../src/services/dashboardService'
import { createProductionLog } from '../../../src/services/productionService'
import { testPrisma } from '../../helpers/testHelper'

describe('Unit: DashboardService (tests/unit/dashboard/dashboard.service.spec.ts)', () => {
  let lowStockProdId: number

  before(async () => {
    // Create product with MinStock = 100 and stock = 10
    const prod = await testPrisma.products.create({
      data: {
        ProductName: 'Unit Test Alert Sensor PT-100',
        Unit: 'pcs',
        MinStock: 100,
      },
    })
    lowStockProdId = prod.ProductID
    await createProductionLog({
      ProductID: lowStockProdId,
      Quantity: 10,
      OperatorName: 'Alert Unit Tester',
    })
  })

  after(async () => {
    if (lowStockProdId) {
      await testPrisma.inventoryMovements.deleteMany({ where: { ProductID: lowStockProdId } })
      await testPrisma.productionLogs.deleteMany({ where: { ProductID: lowStockProdId } })
      await testPrisma.products.deleteMany({ where: { ProductID: lowStockProdId } })
    }
  })

  it('🔴 [getDashboardStats - Calculations]: should compute totalProducts, todayProduction, and recentMovements', async () => {
    const summary = await getDashboardSummary()

    assert.ok(summary)
    assert.equal(typeof summary.totalProducts, 'number')
    assert.ok(summary.totalProducts > 0)
    assert.equal(typeof summary.todayProduction, 'number')
    assert.ok(summary.todayProduction >= 10)
    assert.ok(Array.isArray(summary.recentMovements))
  })
})
