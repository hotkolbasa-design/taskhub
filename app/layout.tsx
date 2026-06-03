import type { Metadata } from 'next'
import { Geologica, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const geologica = Geologica({
  variable: '--font-geologica',
  subsets: ['latin', 'cyrillic'],
  weight: ['300', '400', '500', '600', '700'],
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
})

export const metadata: Metadata = {
  title: 'Task Hub',
  description: 'Внутренняя платформа управления задачами',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${geologica.variable} ${jetbrainsMono.variable} h-full`}>
      <body className="h-full">{children}</body>
    </html>
  )
}
