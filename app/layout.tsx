import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'US-EAST-1 Exposure Tracker',
  description: 'Track which services still have exposure to AWS US-EAST-1 outages',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50">{children}</body>
    </html>
  )
}
