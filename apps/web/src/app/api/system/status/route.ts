import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:6061',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function GET() {
  const startTime = Date.now()
  try {
    const [productsCount, logsCount, movementsCount, usersCount] = await Promise.all([
      prisma.products.count(),
      prisma.productionLogs.count(),
      prisma.inventoryMovements.count(),
      prisma.users.count(),
    ])

    const latencyMs = Date.now() - startTime

    return NextResponse.json(
      {
        status: 'healthy',
        database: 'Connected (MSSQL 2022)',
        databaseCatalog: 'FactoryDB',
        backendRuntime: 'Next.js / Node.js Engine (Port 6060)',
        latencyMs,
        counts: {
          products: productsCount,
          productionLogs: logsCount,
          inventoryMovements: movementsCount,
          users: usersCount,
        },
        timestamp: new Date().toISOString(),
      },
      { headers: corsHeaders }
    )
  } catch (error) {
    const latencyMs = Date.now() - startTime
    return NextResponse.json(
      {
        status: 'unhealthy',
        database: 'Disconnected',
        latencyMs,
        error: error instanceof Error ? error.message : 'Database error',
      },
      { status: 500, headers: corsHeaders }
    )
  }
}
