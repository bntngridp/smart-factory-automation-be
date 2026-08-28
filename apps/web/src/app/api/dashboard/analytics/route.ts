import { NextRequest, NextResponse } from 'next/server'
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const timeframe = (searchParams.get('timeframe') || '7D').toUpperCase()

    const now = new Date()

    if (timeframe === '7D') {
      // Last 7 days
      const startDate = new Date(now)
      startDate.setDate(now.getDate() - 6)
      startDate.setHours(0, 0, 0, 0)

      const logs = await prisma.productionLogs.findMany({
        where: {
          ProductionDate: {
            gte: startDate,
          },
        },
        select: {
          ProductionDate: true,
          Quantity: true,
        },
      })

      // Aggregate by day (YYYY-MM-DD)
      const dayMap: Record<string, number> = {}
      for (let i = 0; i < 7; i++) {
        const d = new Date(startDate)
        d.setDate(startDate.getDate() + i)
        const dateKey = d.toISOString().split('T')[0]
        dayMap[dateKey] = 0
      }

      logs.forEach((log) => {
        if (!log.ProductionDate) return
        const dateKey = new Date(log.ProductionDate).toISOString().split('T')[0]
        if (dayMap[dateKey] !== undefined) {
          dayMap[dateKey] += log.Quantity
        }
      })

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const dayKeys = ['days_sun', 'days_mon', 'days_tue', 'days_wed', 'days_thu', 'days_fri', 'days_sat']

      const data = Object.keys(dayMap).map((dateKey) => {
        const d = new Date(dateKey + 'T00:00:00')
        const dayIdx = d.getDay()
        return {
          date: dateKey,
          dayKey: dayKeys[dayIdx],
          name: dayNames[dayIdx],
          production: dayMap[dateKey],
        }
      })

      return NextResponse.json(
        {
          timeframe: '7D',
          total_period_production: logs.reduce((sum, l) => sum + l.Quantity, 0),
          data,
        },
        { status: 200, headers: corsHeaders }
      )
    } else if (timeframe === '30D') {
      // Last 30 days
      const startDate = new Date(now)
      startDate.setDate(now.getDate() - 29)
      startDate.setHours(0, 0, 0, 0)

      const logs = await prisma.productionLogs.findMany({
        where: {
          ProductionDate: {
            gte: startDate,
          },
        },
        select: {
          ProductionDate: true,
          Quantity: true,
        },
      })

      // Aggregate into 30 daily buckets
      const dayMap: Record<string, number> = {}
      for (let i = 0; i < 30; i++) {
        const d = new Date(startDate)
        d.setDate(startDate.getDate() + i)
        const dateKey = d.toISOString().split('T')[0]
        dayMap[dateKey] = 0
      }

      logs.forEach((log) => {
        if (!log.ProductionDate) return
        const dateKey = new Date(log.ProductionDate).toISOString().split('T')[0]
        if (dayMap[dateKey] !== undefined) {
          dayMap[dateKey] += log.Quantity
        }
      })

      const data = Object.keys(dayMap).map((dateKey) => {
        const d = new Date(dateKey + 'T00:00:00')
        const monthShort = d.toLocaleString('en-US', { month: 'short' })
        const dayNum = d.getDate()
        return {
          date: dateKey,
          name: `${dayNum} ${monthShort}`,
          production: dayMap[dateKey],
        }
      })

      return NextResponse.json(
        {
          timeframe: '30D',
          total_period_production: logs.reduce((sum, l) => sum + l.Quantity, 0),
          data,
        },
        { status: 200, headers: corsHeaders }
      )
    } else {
      // YTD (Year-to-Date: 12 months)
      const currentYear = now.getFullYear()
      const startDate = new Date(currentYear, 0, 1, 0, 0, 0, 0)

      const logs = await prisma.productionLogs.findMany({
        where: {
          ProductionDate: {
            gte: startDate,
          },
        },
        select: {
          ProductionDate: true,
          Quantity: true,
        },
      })

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const monthMap: Record<number, number> = {}
      for (let m = 0; m < 12; m++) {
        monthMap[m] = 0
      }

      logs.forEach((log) => {
        if (!log.ProductionDate) return
        const d = new Date(log.ProductionDate)
        if (d.getFullYear() === currentYear) {
          const m = d.getMonth()
          monthMap[m] = (monthMap[m] || 0) + log.Quantity
        }
      })

      const data = monthNames.map((monthName, idx) => ({
        monthIndex: idx,
        name: monthName,
        production: monthMap[idx] || 0,
      }))

      return NextResponse.json(
        {
          timeframe: 'YTD',
          total_period_production: logs.reduce((sum, l) => sum + l.Quantity, 0),
          data,
        },
        { status: 200, headers: corsHeaders }
      )
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}
