import type { NextAuthConfig } from 'next-auth'

export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/signin',
  },
  providers: [], // We only need this config for middleware session token decryption
}
