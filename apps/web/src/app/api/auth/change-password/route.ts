import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { changeUserPassword } from '@/services/authService'

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
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Sesi login tidak valid / kedaluwarsa' }, { status: 401, headers: corsHeaders })
    }

    const body = await request.json()
    const { currentPassword, newPassword } = body

    const result = await changeUserPassword(session.UserID, currentPassword, newPassword)
    return NextResponse.json(result, { headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memperbarui kata sandi'
    return NextResponse.json({ error: message }, { status: 400, headers: corsHeaders })
  }
}
