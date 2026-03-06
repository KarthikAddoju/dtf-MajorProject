import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import ClientLayout from "@/components/ClientLayout"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "sonner"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  title: "DACS - Decentralized Academic Credential System",
  description:
    "Secure, immutable, and verifiable academic credentials on the blockchain.",
}

export const viewport: Viewport = {
  themeColor: "#0f0f23",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} font-sans antialiased min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-black text-white`}
      >
        <ClientLayout>{children}</ClientLayout>

        {/* Web3 transaction notifications */}
        <Toaster richColors position="top-right" />

        <Analytics />
      </body>
    </html>
  )
}