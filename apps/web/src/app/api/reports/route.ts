import { NextResponse } from 'next/server'
import { getReportsAnalytics } from '@/services/reportService'

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
    const data = await getReportsAnalytics()
    return NextResponse.json(data, { status: 200, headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}
