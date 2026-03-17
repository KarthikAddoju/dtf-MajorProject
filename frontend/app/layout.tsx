import type { Metadata, Viewport } from "next"
import ClientLayout from "@/components/ClientLayout"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "sonner"
import "./globals.css"

export const metadata: Metadata = {
  title: "DACS - Decentralized Academic Credential System",
  description:
    "Secure, immutable, and verifiable academic credentials on the blockchain.",
}

export const viewport: Viewport = {
  themeColor: "#090d16",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#090d16] font-sans text-[#f6efe3] antialiased">
        <ClientLayout>{children}</ClientLayout>

        {/* Web3 transaction notifications */}
        <Toaster richColors position="top-right" />

        <Analytics />
      </body>
    </html>
  )
}
