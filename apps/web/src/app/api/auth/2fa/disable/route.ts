import { NextRequest, NextResponse } from 'next/server'
import { getSession, verifyToken } from '@/lib/auth'
import { disable2FA } from '@/services/twoFactorService'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:6061',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  try {
    let session = await getSession()
    if (!session) {
      const authHeader = request.headers.get('Authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        session = await verifyToken(authHeader.substring(7))
      }
    }

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
    }

    const body = await request.json().catch(() => ({}))
    const { password, code } = body

    const result = await disable2FA(session.UserID, { password, code })

    return NextResponse.json(result, { headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal menonaktifkan 2FA'
    return NextResponse.json(
      { error: message },
      { status: 400, headers: corsHeaders }
    )
  }
}
