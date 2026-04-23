import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Logged out' })
  response.cookies.set('auth-token', '', { httpOnly: true, maxAge: 0 })
  return response
}
