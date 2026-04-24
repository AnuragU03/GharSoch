import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { IframeLoggerInit } from '@/components/IframeLoggerInit'
import ClientProviders from '@/components/ClientProviders'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Next.js App',
  description: 'Built with Next.js, React, and Tailwind CSS',
  icons: {
    icon: '/lyzr.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
