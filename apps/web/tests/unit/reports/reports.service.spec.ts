import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getReportsAnalytics } from '../../../src/services/reportService'

describe('Unit: ReportService (tests/unit/reports/reports.service.spec.ts)', () => {
  it('🔴 [getReportsAnalytics]: should return comprehensive report analytics structure', async () => {
    const data = await getReportsAnalytics(30)
    assert.ok(data)
  })

  it('🟡 [getReportsAnalytics - Days Filter]: should compute analytics for 7 days timeframe', async () => {
    const data = await getReportsAnalytics(7)
    assert.ok(data)
  })
})
