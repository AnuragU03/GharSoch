import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import { signToken } from '@/lib/auth'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email and password required' }, { status: 400 })
    }

    const users = await getCollection('users')
    const existing = await users.findOne({ email: email.toLowerCase() })
    if (existing) {
      return NextResponse.json({ success: false, error: 'User already exists' }, { status: 409 })
    }

    const salt = crypto.randomBytes(16).toString('hex')
    const passwordHash = crypto.createHash('sha256').update(password + salt).digest('hex')
    const id = uuidv4()
    const user = { id, email: email.toLowerCase(), name: name || email.split('@')[0], passwordHash, salt, role: 'user', createdAt: new Date().toISOString() }
    await users.insertOne(user)

    const token = await signToken({ id, email: user.email, role: user.role })
    const response = NextResponse.json({ success: true, user: { id, email: user.email, name: user.name, role: user.role } })
    response.cookies.set('auth-token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24 })
    return response
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 })
  }
}
