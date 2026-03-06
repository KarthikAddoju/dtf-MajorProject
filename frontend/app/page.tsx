"use client"

import { PageLayout } from "@/components/PageLayout"
import { FeatureCard } from "@/components/FeatureCard"

export default function HomePage() {
  return (
    <PageLayout>
      {/* Hero Section */}
      <section className="relative py-20 lg:py-32">
        {/* Background Glow Effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 bg-white/5 border border-white/10 rounded-full">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm text-slate-400">Powered by Blockchain Technology</span>
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold mb-6 text-balance">
            <span className="text-white">Decentralized</span>
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
              Academic Credential
            </span>
            <br />
            <span className="text-white">System</span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl sm:text-2xl text-slate-400 mb-12">
            <span className="text-blue-400">Secure</span>
            <span className="mx-3 text-slate-600">•</span>
            <span className="text-purple-400">Immutable</span>
            <span className="mx-3 text-slate-600">•</span>
            <span className="text-green-400">Verifiable</span>
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl hover:from-blue-500 hover:to-purple-500 transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02]">
              Connect Wallet
            </button>
            <button className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-white bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all duration-200 hover:scale-[1.02]">
              Verify Certificate
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Why Choose DACS?
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-pretty">
            Our decentralized platform ensures your academic credentials are secure,
            tamper-proof, and instantly verifiable worldwide.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard
            title="Blockchain Verification"
            description="All certificates are stored on the blockchain, ensuring immutability and transparency. Verify any credential instantly with cryptographic proof."
            icon={
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            }
          />
          <FeatureCard
            title="NFT Certificates"
            description="Each verified certificate is minted as a unique NFT, giving you true ownership of your academic achievements that you can showcase anywhere."
            icon={
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                />
              </svg>
            }
          />
          <FeatureCard
            title="EDU Token Rewards"
            description="Earn EDU tokens when your certificates are verified. Use them within the ecosystem or trade them on supported exchanges."
            icon={
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          />
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20">
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-3xl p-8 sm:p-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-white mb-2">10K+</div>
              <div className="text-slate-400">Certificates Issued</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-white mb-2">5K+</div>
              <div className="text-slate-400">Students Registered</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-white mb-2">500+</div>
              <div className="text-slate-400">Institutions</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-white mb-2">1M+</div>
              <div className="text-slate-400">EDU Tokens Distributed</div>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  )
}
