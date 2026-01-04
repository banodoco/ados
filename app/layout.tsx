import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

// Helper to safely parse URL with fallback
function getMetadataBase(): URL {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  // Must be a non-empty string that looks like a URL (starts with http)
  if (appUrl && typeof appUrl === 'string' && appUrl.startsWith('http')) {
    try {
      return new URL(appUrl)
    } catch (e) {
      // Log the error but don't crash
      console.warn(`Invalid NEXT_PUBLIC_APP_URL: "${appUrl}", falling back to localhost`)
    }
  }
  // Always fallback to localhost if anything is wrong
  return new URL('http://localhost:3000')
}

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: 'ADOS - Los Angeles | November 7th',
  description: 'A celebration of art and open-source AI',
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: '/apple-icon.png',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'ADOS - Los Angeles | November 7th',
    description: 'A celebration of art and open-source AI',
    url: 'https://ados.events',
    siteName: 'ADOS',
    images: [
      {
        url: '/bg_poster.jpg',
        width: 1200,
        height: 630,
        alt: 'ADOS Event',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ADOS - Los Angeles | November 7th',
    description: 'A celebration of art and open-source AI',
    images: ['/bg_poster.jpg'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/icon.png" sizes="512x512" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </head>
      <body className={inter.className}>
        <main>
          {children}
        </main>
      </body>
    </html>
  )
}

