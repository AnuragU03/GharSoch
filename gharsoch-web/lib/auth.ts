import { NextRequest, NextResponse } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'
import { getCollection } from './mongodb'

const JWT_SECRET = process.env.APP_JWT_SECRET || 'your-default-secret-change-me'
const secret = new TextEncoder().encode(JWT_SECRET)

export async function signToken(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret)
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload
  } catch (error) {
    return null
  }
}

export async function getCurrentUser(req: NextRequest) {
  const token = req.cookies.get('auth-token')?.value || req.headers.get('authorization')?.split(' ')[1]
  if (!token) return null
  
  const payload = await verifyToken(token)
  if (!payload || !payload.id) return null
  
  const users = await getCollection('users')
  const user = await users.findOne({ id: payload.id })
  return user
}

export function authMiddleware(handler: (req: NextRequest, user: any) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    const user = await getCurrentUser(req)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    return handler(req, user)
  }
}
