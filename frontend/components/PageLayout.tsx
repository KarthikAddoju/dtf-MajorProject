"use client"

import { ReactNode } from "react"

interface PageLayoutProps {
  children: ReactNode
}

export function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="brand-shell min-h-screen">
      <main className="brand-grid relative mx-auto max-w-[1480px] px-4 py-8 pb-28 sm:px-6 sm:py-10 sm:pb-12 lg:px-8 lg:py-12 lg:pb-16">
        {children}
      </main>
    </div>
  )
}
