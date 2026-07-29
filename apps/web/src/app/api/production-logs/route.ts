import { NextRequest, NextResponse } from 'next/server'
import { getProductionLogs, createProductionLog } from '@/services/productionService'
import { createProductionLogSchema, formatZodError } from '@/lib/validations'

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

export async function GET() {
  try {
    const logs = await getProductionLogs()
    return NextResponse.json(logs, { status: 200, headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createProductionLogSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(formatZodError(parsed.error), { status: 400, headers: corsHeaders })
    }

    const log = await createProductionLog({
      ProductID: parsed.data.product_id,
      Quantity: parsed.data.quantity,
      OperatorName: parsed.data.operator_name,
    })

    return NextResponse.json(log, { status: 201, headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan'

    if (message.includes('tidak ditemukan')) {
      return NextResponse.json({ error: message }, { status: 404, headers: corsHeaders })
    }

    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}
