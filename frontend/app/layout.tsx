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
  themeColor: "#0f0f0f",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0f0f0f] font-sans text-[#f0f0f0] antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[#4f7ef5] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
        >
          Skip to main content
        </a>
        <ClientLayout>{children}</ClientLayout>

        <Toaster
          richColors
          position="bottom-right"
          toastOptions={{
            duration: 3500,
            style: {
              borderRadius: "12px",
              fontSize: "0.875rem",
            },
          }}
        />

        <Analytics />
      </body>
    </html>
  )
}
