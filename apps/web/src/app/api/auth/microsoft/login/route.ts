import { NextRequest, NextResponse } from 'next/server'
import { getMicrosoftAuthUrl } from '@/services/microsoftAuthService'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:6061',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const state = searchParams.get('state') || 'forge_sso'
    const { url, isConfigured } = getMicrosoftAuthUrl(state)

    // If client asks for JSON URL endpoint
    const acceptHeader = request.headers.get('accept') || ''
    if (acceptHeader.includes('application/json') || searchParams.get('format') === 'json') {
      return NextResponse.json({ url, isConfigured }, { headers: corsHeaders })
    }

    // Otherwise perform direct HTTP 302 Redirect
    return NextResponse.redirect(url)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal menginisialisasi login Microsoft'
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}
