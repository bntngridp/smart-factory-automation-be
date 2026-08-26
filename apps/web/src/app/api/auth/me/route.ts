import { NextRequest, NextResponse } from 'next/server'
import { getSession, verifyToken } from '@/lib/auth'
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

export async function GET(request: NextRequest) {
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

  // Fetch live state from database
  const user = await prisma.users.findUnique({
    where: { UserID: session.UserID },
    select: {
      UserID: true,
      Username: true,
      Role: true,
      TwoFactorEnabled: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404, headers: corsHeaders })
  }

  return NextResponse.json({ user }, { headers: corsHeaders })
}
