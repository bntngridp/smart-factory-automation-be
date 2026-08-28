import { prisma } from '@/lib/db'
import { signToken, hashPassword } from '@/lib/auth'

export interface MicrosoftConfig {
  clientId: string
  clientSecret: string
  tenantId: string
  redirectUri: string
  frontendUrl: string
}

export function getMicrosoftConfig(): MicrosoftConfig {
  return {
    clientId: process.env.MICROSOFT_CLIENT_ID || 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
    redirectUri: process.env.NEXT_PUBLIC_MICROSOFT_REDIRECT_URI || 'http://localhost:6060/api/auth/microsoft/callback',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:6061',
  }
}

export function isMicrosoftConfigured(): boolean {
  const config = getMicrosoftConfig()
  return (
    config.clientId !== 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' &&
    config.clientSecret !== 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' &&
    config.clientId.trim() !== '' &&
    config.clientSecret.trim() !== ''
  )
}

/**
 * Generates the official Microsoft Entra ID Authorization URL
 */
export function getMicrosoftAuthUrl(state = 'forge_sso_session'): { url: string; isConfigured: boolean } {
  const config = getMicrosoftConfig()
  const isConfigured = isMicrosoftConfigured()

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    response_mode: 'query',
    scope: 'openid profile email User.Read',
    state,
  })

  const url = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize?${params.toString()}`

  return { url, isConfigured }
}

export interface MicrosoftUserProfile {
  id: string
  displayName?: string
  mail?: string
  userPrincipalName?: string
}

/**
 * Exchanges authorization code for access token and fetches Microsoft user profile
 */
export async function exchangeCodeAndFetchProfile(code: string): Promise<MicrosoftUserProfile> {
  const config = getMicrosoftConfig()

  if (!isMicrosoftConfigured()) {
    throw new Error(
      'Kredensial Microsoft Entra ID (MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET) belum dikonfigurasi di file .env backend.'
    )
  }

  const tokenEndpoint = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`
  const bodyParams = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
    scope: 'openid profile email User.Read',
  })

  const tokenRes = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: bodyParams.toString(),
  })

  if (!tokenRes.ok) {
    const errorData = await tokenRes.json().catch(() => ({}))
    throw new Error(
      `Gagal menukar token dengan Microsoft: ${errorData.error_description || errorData.error || tokenRes.statusText}`
    )
  }

  const tokenData = await tokenRes.json()
  const accessToken = tokenData.access_token

  // Fetch Microsoft Graph Profile
  const graphRes = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!graphRes.ok) {
    throw new Error('Gagal mengambil profil akun dari Microsoft Graph API')
  }

  return await graphRes.json()
}

/**
 * Processes Microsoft SSO profile, provisions or finds user, and returns JWT session
 */
export async function handleMicrosoftSSOLogin(profile: MicrosoftUserProfile) {
  const email = (profile.mail || profile.userPrincipalName || '').toLowerCase()
  if (!email) {
    throw new Error('Akun Microsoft tidak memiliki email atau userPrincipalName yang valid.')
  }

  let username = email.split('@')[0]
  // Sanitize username: lowercase, alphanumeric and underscores only
  username = username.toLowerCase().replace(/[^a-z0-9_]/g, '')
  if (!username) username = `ms_user_${profile.id.substring(0, 8)}`

  // Check if user already exists
  let user = await prisma.users.findUnique({
    where: { Username: username },
  })

  let isNewUser = false

  if (!user) {
    // Automatically provision new corporate employee user
    const placeholderPassword = await hashPassword(`MS_SSO_${Date.now()}_${Math.random()}`)
    user = await prisma.users.create({
      data: {
        Username: username,
        Password: placeholderPassword,
        Role: 'operator', // Default corporate role
        TwoFactorEnabled: false,
      },
    })
    isNewUser = true
  }

  // Issue system JWT Token
  const token = await signToken({
    UserID: user.UserID,
    Username: user.Username,
    Role: user.Role,
  })

  return {
    token,
    user: {
      UserID: user.UserID,
      Username: user.Username,
      Role: user.Role,
    },
    isNewUser,
  }
}
