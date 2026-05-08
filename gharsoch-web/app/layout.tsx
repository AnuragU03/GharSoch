import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { IframeLoggerInit } from '@/components/IframeLoggerInit'
import ClientProviders from '@/components/ClientProviders'
import { validateEnv } from '@/lib/envCheck'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Next.js App',
  description: 'Built with Next.js, React, and Tailwind CSS',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  validateEnv()
  const isPaidUser = process.env.IS_PAID_USER === 'true'
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <IframeLoggerInit />
        <ClientProviders>
          {children}
        </ClientProviders>

      </body>
    </html>
  )
}
