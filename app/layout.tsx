import type React from "react"
import type { Metadata } from "next"
import { Space_Grotesk, DM_Sans } from "next/font/google"
import "./globals.css"
import { ToastProvider } from "@/components/ui/toast-provider"
import { ReduxProvider } from "@/providers/redux-provider"

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
})

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-sans",
})

export const metadata: Metadata = {
  title: "SCANITY",
  description: "Professional QR code scanner web app.",
  keywords: "QR Scanner, VELOCE, Scanner",
  authors: [{ name: "VELOCE TECHNOLOGIES" }],
  openGraph: {
    title: "SCANITY",
    description: "Professional QR code scanner web app.",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "SCANITY",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SCANITY",
    description: "Professional QR code scanner web app.",
    images: ["/twitter-image.jpg"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  generator: "https://veloce-technology.com",
  robots: "index, follow",
  viewport: "width=device-width, initial-scale=1",
};

export default function RootLayout({
                                     children,
                                   }: Readonly<{
  children: React.ReactNode
}>) {
  return (
      <html lang="en" className={`${spaceGrotesk.variable} ${dmSans.variable} antialiased`}>
      <body className="font-sans" suppressHydrationWarning>
      <ReduxProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </ReduxProvider>
      </body>
      </html>
  )
}