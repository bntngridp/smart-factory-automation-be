import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { requestApi, loginAndGetCookie } from '../../helpers/testHelper'

describe('Integration: Dashboard Summary API (tests/integration/dashboard/dashboard.integration.spec.ts)', () => {
  let sessionCookie: string

  before(async () => {
    sessionCookie = await loginAndGetCookie()
  })

  it('🔴 Flow: GET /api/dashboard/summary -> verify contract KPIs & low stock alerts', async () => {
    const res = await requestApi('/api/dashboard/summary', {}, sessionCookie)

    assert.equal(res.status, 200)
    assert.equal(typeof res.body.total_products, 'number')
    assert.equal(typeof res.body.total_production_today, 'number')
    assert.ok(Array.isArray(res.body.low_stock_alerts))
  })
})
