"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { DashboardCard } from "@/components/DashboardCard"
import { EmptyStatePanel } from "@/components/EmptyStatePanel"
import { MetricCard } from "@/components/MetricCard"
import { PageLayout } from "@/components/PageLayout"
import { StatusBanner } from "@/components/StatusBanner"
import { fetchInstituteProfile, isAbortError } from "@/lib/api"
import {
  formatCredentialTypeLabel,
  formatDateTime,
  truncateValue,
} from "@/lib/formatting"
import type { InstituteProfile } from "@/lib/types"

export default function InstituteProfilePage() {
  const params = useParams<{ slug: string }>()
  const slug = typeof params?.slug === "string" ? params.slug : ""
  const [profile, setProfile] = useState<InstituteProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) {
      setErrorMessage("Institute not found")
      setIsLoading(false)
      return
    }

    const controller = new AbortController()

    async function loadProfile() {
      try {
        setIsLoading(true)
        setErrorMessage(null)
        const response = await fetchInstituteProfile(slug, controller.signal)

        if (controller.signal.aborted) {
          return
        }

        setProfile(response.profile)
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) {
          return
        }

        const message =
          error instanceof Error ? error.message : "Could not load institute profile"
        setProfile(null)
        setErrorMessage(message)
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadProfile()

    return () => controller.abort()
  }, [slug])

  const courseLeaderboard = useMemo(() => {
    return (profile?.topCourses ?? []).map((course) => ({
      ...course,
      ratio:
        (profile?.topCourses?.[0]?.totalEduMinted ?? 0) > 0
          ? Math.max(
              12,
              Math.round(
                (course.totalEduMinted / (profile?.topCourses?.[0]?.totalEduMinted ?? 1)) *
                  100
              )
            )
          : 12,
    }))
  }, [profile?.topCourses])
  const leadCourse = courseLeaderboard[0] ?? null
  const instituteInsight = profile
    ? profile.stats.mintedCredentials > 0
      ? `${profile.institute.name} has issued ${profile.stats.mintedCredentials} verified credentials to ${profile.stats.uniqueStudents} students, with ${profile.stats.totalEduMinted.toLocaleString()} EDU distributed so far.`
      : `${profile.institute.name} is listed in DACS, but public mint activity has not started yet.`
    : null

  return (
    <PageLayout>
      {isLoading ? (
        <DashboardCard>
          <div className="py-16 text-center text-slate-300">
            Loading institute profile...
          </div>
        </DashboardCard>
      ) : errorMessage || !profile ? (
        <DashboardCard>
          <EmptyStatePanel
            title="Profile unavailable"
            description={
              errorMessage ?? "The requested institute profile could not be found."
            }
            action={
              <Link
                href="/colleges"
                className="brand-button-secondary px-5 py-3 text-sm"
              >
                Return to College Index
              </Link>
            }
          />
        </DashboardCard>
      ) : (
        <>
          <section className="mb-10 rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(184,137,45,0.14),rgba(15,118,110,0.1),rgba(12,16,24,0.96))] p-8 shadow-[0_24px_80px_rgba(8,12,18,0.28)]">
            <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-4xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#b8892d]/30 bg-[#b8892d]/12 px-4 py-2 text-sm text-[#f3d9a2]">
                  Institute Trust Profile
                </div>
                <div className="mt-5 text-xs uppercase tracking-[0.34em] text-[#d4c3a3]">
                  {profile.institute.shortCode} • Public Academic Reputation Surface
                </div>
                <h1 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">
                  {profile.institute.name}
                </h1>
                <p className="mt-4 max-w-3xl text-lg text-slate-300">
                  This public profile tracks how this institute is issuing verified
                  credentials, rewarding students with EDU, and participating in the
                  DACS academic trust network.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Last Mint
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white">
                    {formatDateTime(profile.stats.lastMintedAt)}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Status
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white">
                    {profile.institute.isActive ? "Accepting uploads" : "Archived"}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Slug
                  </div>
                  <div className="mt-2 font-mono text-sm text-[#b9e7df]">
                    {profile.institute.slug}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              title="EDU Minted"
              value={
                <span className="text-[#f3d9a2]">
                  {profile.stats.totalEduMinted.toLocaleString()} EDU
                </span>
              }
              accentColor="yellow"
            />
            <MetricCard
              title="Credentials"
              value={<span className="text-[#dbeadd]">{profile.stats.mintedCredentials}</span>}
              accentColor="green"
            />
            <MetricCard
              title="Students"
              value={<span className="text-[#c8dfdc]">{profile.stats.uniqueStudents}</span>}
              accentColor="blue"
            />
            <MetricCard
              title="Pending Review"
              value={<span className="text-[#f3d9a2]">{profile.stats.pendingSubmissions}</span>}
              accentColor="yellow"
            />
            <MetricCard
              title="Rejected"
              value={<span className="text-[#f0c5cc]">{profile.stats.rejectedSubmissions}</span>}
              accentColor="purple"
            />
          </div>

          {instituteInsight ? (
            <div className="mb-8 grid gap-6 xl:grid-cols-[1.02fr_0.98fr] xl:items-start">
              <DashboardCard title="Institute Position">
                <div className="space-y-4">
                  <p className="text-[#d8e0ec]">{instituteInsight}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                        Issuance posture
                      </div>
                      <div className="mt-2 text-white">
                        {profile.stats.pendingSubmissions > 0
                          ? `${profile.stats.pendingSubmissions} submissions are still in review`
                          : "No current review backlog"}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                        Strongest credential line
                      </div>
                      <div className="mt-2 text-white">
                        {leadCourse
                          ? `${leadCourse.courseName} • ${leadCourse.totalEduMinted.toLocaleString()} EDU`
                          : "Waiting for live mint activity"}
                      </div>
                    </div>
                  </div>
                </div>
              </DashboardCard>

              <StatusBanner
                tone="neutral"
                title="How to read this profile"
                message="This page blends public workflow health with minted credential history. EDU totals show reward volume, while credential and student counts show how widely the institute is creating verifiable outcomes."
              />
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-[0.95fr_1.05fr] xl:items-start">
            <DashboardCard title="Top Credential Titles">
              {courseLeaderboard.length === 0 ? (
                <EmptyStatePanel
                  eyebrow="Title rankings"
                  title="No credential leaderboard yet"
                  description="This panel will highlight the strongest credential lines once the institute starts minting verified outcomes on DACS."
                />
              ) : (
                <div className="space-y-4">
                  {courseLeaderboard.map((course, index) => (
                    <div
                      key={course.courseName}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-xs uppercase tracking-[0.2em] text-[#f3d9a2]">
                            Credential Rank #{index + 1}
                          </div>
                          <div className="mt-2 text-lg font-semibold text-white [overflow-wrap:anywhere]">
                            {course.courseName}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <div className="text-sm text-slate-400">
                              {course.mintedCount} minted credentials
                            </div>
                            <div className="rounded-full border border-[#b8892d]/20 bg-[#b8892d]/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#f3d9a2]">
                              {formatCredentialTypeLabel(course.credentialType)}
                            </div>
                          </div>
                        </div>
                        <div className="rounded-full border border-[#0f766e]/30 bg-[#0f766e]/12 px-3 py-1 text-xs font-medium text-[#b9e7df]">
                          {course.totalEduMinted.toLocaleString()} EDU
                        </div>
                      </div>

                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/30">
                        <div
                          className="h-full rounded-full bg-linear-to-r from-[#b8892d] via-[#0f766e] to-[#2f7b68]"
                          style={{ width: `${course.ratio}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DashboardCard>

            <DashboardCard title="Recent Verified Credentials">
              {profile.recentCredentials.length === 0 ? (
                <EmptyStatePanel
                  eyebrow="Public credential feed"
                  title="No public credentials yet"
                  description="Minted credentials from this institute will appear here once verified outcomes go live on DACS."
                  action={
                    <Link
                      href="/colleges"
                      className="brand-button-secondary px-5 py-3 text-sm"
                    >
                      Back To College Index
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-4">
                  {profile.recentCredentials.map((credential) => (
                    <div
                      key={credential.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="text-xs uppercase tracking-[0.2em] text-[#0fba9b]">
                            {credential.tokenId
                              ? `Token #${credential.tokenId}`
                              : "Credential record"}
                          </div>
                          <h3 className="mt-2 text-lg font-semibold text-white [overflow-wrap:anywhere]">
                            {credential.courseName}
                          </h3>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <div className="rounded-full border border-[#b8892d]/20 bg-[#b8892d]/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-[#f3d9a2]">
                              {formatCredentialTypeLabel(credential.credentialType)}
                            </div>
                            <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-300">
                              Student {truncateValue(credential.studentAddress, 10, 8)}
                            </div>
                            <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-300">
                              {credential.eduAmount !== null
                                ? `${credential.eduAmount.toLocaleString()} EDU`
                                : "Reward pending"}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                            Minted
                          </div>
                          <div className="mt-2 text-sm text-white">
                            {formatDateTime(credential.mintedAt)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        {credential.tokenId ? (
                          <Link
                            href={`/verify?tokenId=${credential.tokenId}`}
                            className="rounded-xl bg-linear-to-r from-[#b8892d] to-[#0f766e] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                          >
                            Open Credential Sheet
                          </Link>
                        ) : null}
                        {credential.publicProofUrl ? (
                          <a
                            href={credential.publicProofUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                          >
                            Open Public Proof
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DashboardCard>
          </div>
        </>
      )}
    </PageLayout>
  )
}
