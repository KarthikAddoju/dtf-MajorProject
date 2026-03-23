"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { EmptyStatePanel } from "@/components/EmptyStatePanel"
import { MetricCard } from "@/components/MetricCard"
import { PageLayout } from "@/components/PageLayout"
import { SkeletonBlock } from "@/components/SkeletonBlock"
import { StatusBanner } from "@/components/StatusBanner"
import {
  fetchAnalyticsOverview,
  fetchCollegeLeaderboard,
  isAbortError,
} from "@/lib/api"
import {
  formatCredentialTypeLabel,
  formatDateTime,
  truncateValue,
} from "@/lib/formatting"
import type { AnalyticsOverview, CollegeLeaderboardEntry } from "@/lib/types"

export default function CollegesPage() {
  const [colleges, setColleges] = useState<CollegeLeaderboardEntry[]>([])
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    const controller = new AbortController()

    async function loadLeaderboard() {
      try {
        setIsLoading(true)
        setErrorMessage(null)
        const [leaderboardResponse, overviewResponse] = await Promise.all([
          fetchCollegeLeaderboard(controller.signal),
          fetchAnalyticsOverview(controller.signal),
        ])

        if (controller.signal.aborted) {
          return
        }

        setColleges(leaderboardResponse.colleges)
        setOverview(overviewResponse.overview)
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) {
          return
        }

        const message =
          error instanceof Error ? error.message : "Could not load the college index"
        setErrorMessage(message)
        setOverview(null)
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadLeaderboard()

    return () => controller.abort()
  }, [])

  const totals = useMemo(() => {
    return colleges.reduce(
      (summary, college) => ({
        totalEduMinted: summary.totalEduMinted + college.totalEduMinted,
        totalCertificates: summary.totalCertificates + college.mintedCertificates,
        totalStudents: summary.totalStudents + college.uniqueStudents,
      }),
      {
        totalEduMinted: 0,
        totalCertificates: 0,
        totalStudents: 0,
      }
    )
  }, [colleges])
  const filteredColleges = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    if (!normalizedQuery) {
      return colleges
    }

    return colleges.filter((college) =>
      [college.instituteName, college.slug ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    )
  }, [colleges, searchQuery])
  const chartData = useMemo(
    () =>
      filteredColleges.slice(0, 6).map((college) => ({
        name:
          college.instituteName.length > 18
            ? `${college.instituteName.slice(0, 18)}...`
            : college.instituteName,
        totalEduMinted: college.totalEduMinted,
        mintedCertificates: college.mintedCertificates,
      })),
    [filteredColleges]
  )

  const featuredCollege = filteredColleges[0] ?? null
  const leadingShare =
    featuredCollege && totals.totalEduMinted > 0
      ? Math.round((featuredCollege.totalEduMinted / totals.totalEduMinted) * 100)
      : null
  const leaderboardInsight = featuredCollege
    ? `${featuredCollege.instituteName} currently leads with ${featuredCollege.totalEduMinted.toLocaleString()} EDU minted across ${featuredCollege.mintedCertificates} credentials.`
    : "The leaderboard will highlight the lead institute once real mint activity is available."
  const chartAverage =
    filteredColleges.length > 0
      ? Math.round(
          filteredColleges.reduce(
            (sum, college) => sum + college.totalEduMinted,
            0
          ) / filteredColleges.length
        )
      : 0

  return (
    <PageLayout>
      <section className="mb-10 grid gap-8 xl:grid-cols-[1.08fr_0.92fr] xl:items-start">
        <div className="brand-panel-light px-8 py-9 sm:px-10">
          <div className="brand-kicker">Institute Index</div>
          <div className="mt-6 text-[11px] uppercase tracking-[0.34em] text-[#666666]">
            Public / rankings / network momentum
          </div>
          <h1 className="mt-4 max-w-4xl text-5xl font-semibold leading-[0.95] text-[#f0f0f0] sm:text-6xl">
            Rank institutes by real credential issuance, not brochure claims.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#a0a0a0]">
            The college index translates on-chain EDU rewards and minted credential
            activity into a public trust scoreboard for institutes, students, and
            external verifiers.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-white/[0.08] bg-[#2a2a2a] p-5">
              <div className="text-[11px] uppercase tracking-[0.26em] text-[#666666]">
                Active Institutes
              </div>
              <div className="mt-3 text-[2rem] text-[#f0f0f0]">
                {colleges.length}
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-[#2a2a2a] p-5">
              <div className="text-[11px] uppercase tracking-[0.26em] text-[#666666]">
                Verified Students
              </div>
              <div className="mt-3 text-[2rem] text-[#f0f0f0]">
                {totals.totalStudents.toLocaleString()}
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-[#2a2a2a] p-5">
              <div className="text-[11px] uppercase tracking-[0.26em] text-[#666666]">
                Live Search
              </div>
              <div className="mt-3 text-[2rem] text-[#f0f0f0]">
                {filteredColleges.length}
              </div>
            </div>
          </div>
        </div>

        <div className="brand-panel p-7">
          <div className="text-[11px] uppercase tracking-[0.3em] text-[#4f7ef5]">
            Leaderboard Logic
          </div>
          <h2 className="mt-2 text-[2.1rem] font-semibold text-[#f0f0f0]">
            EDU totals, credential volume, and student reach.
          </h2>
          <div className="mt-6 space-y-3">
            {[
              "Only minted credentials contribute to the public institute score.",
              "EDU totals reflect the reward economy attached to verified outcomes.",
              "Each institute row can drill into its own public profile and recent history.",
            ].map((item, index) => (
              <div
                key={item}
                className="grid gap-3 rounded-xl border border-white/[0.06] bg-[rgba(255,255,255,0.03)] p-4 sm:grid-cols-[40px_1fr]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-[#1d2b4a] text-sm font-semibold text-[#f0f0f0]">
                  {index + 1}
                </div>
                <p className="self-center text-[#a0a0a0]">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <MetricCard
          title="Total EDU Minted"
          value={<span className="text-[#4f7ef5]">{totals.totalEduMinted.toLocaleString()} EDU</span>}
          accentColor="yellow"
        />
        <MetricCard
          title="Certificates Minted"
          value={<span className="text-[#a5c0f8]">{totals.totalCertificates.toLocaleString()}</span>}
          accentColor="blue"
        />
        <MetricCard
          title="Participating Students"
          value={<span className="text-[#d7ebd8]">{totals.totalStudents.toLocaleString()}</span>}
          accentColor="green"
        />
      </div>

      <div className="brand-panel mb-8 p-7">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.75fr_0.25fr]">
          <div>
            <label
              htmlFor="collegeSearch"
              className="mb-2 block text-sm font-medium text-[#a0a0a0]"
            >
              Search Institutes
            </label>
            <input
              id="collegeSearch"
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by institute name or slug"
              className="w-full rounded-[20px] border border-white/[0.08] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-[#f0f0f0] placeholder:text-[#a0a0a0] focus:border-[#4f7ef5]/50 focus:outline-none"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[#a0a0a0]">
                Search updates live across institute names and public slugs.
              </p>
              {searchQuery.trim() ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="rounded-full border border-white/[0.08] bg-[rgba(255,255,255,0.05)] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-[#f0f0f0] transition hover:bg-[rgba(255,255,255,0.1)]"
                >
                  Clear Search
                </button>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col justify-end">
            <div className="rounded-[20px] border border-white/[0.06] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[#a0a0a0]">
              Showing {filteredColleges.length} of {colleges.length} institutes
            </div>
          </div>
        </div>
      </div>

      {!isLoading && !errorMessage ? (
        <div className="mb-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr] xl:items-start">
          <div className="brand-panel p-7">
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#4f7ef5]">
              Leaderboard Insight
            </div>
            <h2 className="mt-2 text-[2.1rem] font-semibold text-[#f0f0f0]">
              One primary story from the network.
            </h2>
            <p className="mt-4 max-w-3xl text-[#a0a0a0]">{leaderboardInsight}</p>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-white/[0.06] bg-[rgba(255,255,255,0.03)] p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#a0a0a0]">
                  Average EDU / institute
                </div>
                <div className="mt-2 text-[2rem] text-[#f0f0f0]">
                  {chartAverage.toLocaleString()}
                </div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-[rgba(255,255,255,0.03)] p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#a0a0a0]">
                  Search coverage
                </div>
                <div className="mt-2 text-[2rem] text-[#f0f0f0]">
                  {filteredColleges.length}/{colleges.length}
                </div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-[rgba(255,255,255,0.03)] p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#a0a0a0]">
                  Leader share
                </div>
                <div className="mt-2 text-[2rem] text-[#f0f0f0]">
                  {leadingShare !== null ? `${leadingShare}%` : "Pending"}
                </div>
              </div>
            </div>
          </div>

          <StatusBanner
            tone="neutral"
            title="How to read this index"
            message="Only minted credentials count here. EDU volume shows the reward economy tied to verified outcomes, while certificate and student counts show how broadly an institute is participating."
          />
        </div>
      ) : null}

      {featuredCollege ? (
        <div className="mb-8 grid gap-8 xl:grid-cols-[1.02fr_0.98fr] xl:items-start">
          <div className="brand-panel-light px-8 py-8">
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#666666]">
              Featured Institute
            </div>
            <h2 className="mt-2 text-[3rem] font-semibold leading-[0.95] text-[#f0f0f0]">
              {featuredCollege.instituteName}
            </h2>
            <p className="mt-4 max-w-2xl text-[#a0a0a0]">
              Ranked #{featuredCollege.rank} with{" "}
              {featuredCollege.totalEduMinted.toLocaleString()} EDU minted across{" "}
              {featuredCollege.mintedCertificates} verified credentials.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-white/[0.08] bg-[#2a2a2a] p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#666666]">
                  Rank
                </div>
                <div className="mt-2 text-[2rem] text-[#f0f0f0]">
                  #{featuredCollege.rank}
                </div>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#2a2a2a] p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#666666]">
                  EDU Minted
                </div>
                <div className="mt-2 text-[2rem] text-[#f0f0f0]">
                  {featuredCollege.totalEduMinted.toLocaleString()}
                </div>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-[#2a2a2a] p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#666666]">
                  Last Minted
                </div>
                <div className="mt-2 text-sm font-semibold text-[#f0f0f0]">
                  {formatDateTime(featuredCollege.lastMintedAt)}
                </div>
              </div>
            </div>

            {featuredCollege.slug ? (
              <div className="mt-6">
                <Link
                  href={`/colleges/${featuredCollege.slug}`}
                  className="inline-flex rounded-full bg-[#1a1a1a] px-5 py-3 text-sm font-semibold text-[#f0f0f0] transition hover:bg-[#172136]"
                >
                  Open Institute Profile
                </Link>
              </div>
            ) : null}
          </div>

          <div className="brand-panel p-7">
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#a0a0a0]">
              Ranking Snapshot
            </div>
            <h2 className="mt-2 text-[2.1rem] font-semibold text-[#f0f0f0]">
              Public momentum, captured in one glance.
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-white/[0.06] bg-[rgba(255,255,255,0.03)] p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#a0a0a0]">
                  Leading Share
                </div>
                <div className="mt-2 text-[2.2rem] text-[#f0f0f0]">
                  {leadingShare !== null ? `${leadingShare}%` : "Pending"}
                </div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-[rgba(255,255,255,0.03)] p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#a0a0a0]">
                  Recent Leader
                </div>
                <div className="mt-2 text-sm font-semibold text-[#f0f0f0]">
                  {overview?.leadInstituteName ?? "No live leader yet"}
                </div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-[rgba(255,255,255,0.03)] p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#a0a0a0]">
                  Certificates
                </div>
                <div className="mt-2 text-[2.2rem] text-[#f0f0f0]">
                  {totals.totalCertificates.toLocaleString()}
                </div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-[rgba(255,255,255,0.03)] p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#a0a0a0]">
                  Students
                </div>
                <div className="mt-2 text-[2.2rem] text-[#f0f0f0]">
                  {totals.totalStudents.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {overview ? (
        <div className="mb-8 grid grid-cols-1 gap-8 xl:grid-cols-[0.95fr_1.05fr] xl:items-start">
          <div className="brand-panel p-7">
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#4f7ef5]">
              Network Momentum
            </div>
            <h2 className="mt-2 text-[2.1rem] font-semibold text-[#f0f0f0]">
              EDU minting performance
            </h2>

            <div className="mt-6 h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid stroke="rgba(255, 255, 255, 0.08)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#666666"
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                  />
                  <YAxis
                    stroke="#666666"
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={{
                      background: "#1a1a1a",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "18px",
                      color: "#f0f0f0",
                    }}
                  />
                  <Bar
                    dataKey="totalEduMinted"
                    fill="url(#eduGradient)"
                    radius={[16, 16, 0, 0]}
                  />
                  <defs>
                    <linearGradient id="eduGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4f7ef5" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#6fa8f8" stopOpacity={0.9} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/[0.06] bg-[rgba(255,255,255,0.03)] p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#a0a0a0]">
                  Chart reading
                </div>
                <p className="mt-2 text-sm leading-6 text-[#a0a0a0]">
                  Bars compare EDU minted by the top visible institutes in the current search result.
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-[rgba(255,255,255,0.03)] p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#a0a0a0]">
                  Visible slice
                </div>
                <p className="mt-2 text-sm leading-6 text-[#a0a0a0]">
                  The chart shows up to six institutes at a time so labels stay readable and comparable.
                </p>
              </div>
            </div>
          </div>

          <div className="brand-panel-light px-8 py-7">
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#666666]">
              Recent Verified Credentials
            </div>
            <h2 className="mt-2 text-[2.1rem] font-semibold text-[#f0f0f0]">
              Fresh proof from the network
            </h2>
            {overview.recentActivity.length === 0 ? (
              <div className="mt-6 rounded-xl border border-white/[0.08] bg-[#2a2a2a] p-6 text-center text-[#a0a0a0]">
                The colleges index will show recent mint activity here once new
                credentials are issued.
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {overview.recentActivity.slice(0, 4).map((activity) => (
                  <div
                    key={activity.id}
                    className="rounded-xl border border-white/[0.08] bg-[#2a2a2a] p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-[11px] uppercase tracking-[0.26em] text-[#5f7f68]">
                          {activity.tokenId ? `Token #${activity.tokenId}` : "Minted Record"}
                        </div>
                        <div className="mt-2 text-[1.55rem] font-semibold text-[#f0f0f0] [overflow-wrap:anywhere]">
                          {activity.courseName}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <div className="text-sm text-[#a0a0a0]">
                            {activity.instituteName}
                          </div>
                          <div className="rounded-full border border-white/[0.10] bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#666666]">
                            {formatCredentialTypeLabel(activity.credentialType)}
                          </div>
                        </div>
                      </div>
                      <div className="rounded-full border border-[#4f7ef5]/20 bg-[#4f7ef5]/08 px-3 py-1 text-xs font-medium text-[#a5c0f8]">
                        {activity.eduAmount !== null
                          ? `${activity.eduAmount.toLocaleString()} EDU`
                          : "Reward pending"}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                      <span className="font-mono text-[#a0a0a0]">
                        {truncateValue(activity.studentAddress, 10, 8)}
                      </span>
                      <span className="text-[#a0a0a0]">
                        {formatDateTime(activity.mintedAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <SkeletonBlock variant="metric" />
            <SkeletonBlock variant="metric" />
            <SkeletonBlock variant="metric" />
          </div>
          <SkeletonBlock variant="card" lines={3} />
          <SkeletonBlock variant="card" lines={3} />
          <SkeletonBlock variant="card" lines={3} />
        </div>
      ) : errorMessage ? (
        <div className="brand-panel p-8">
          <EmptyStatePanel
            title="Could not load the leaderboard"
            description={errorMessage}
            action={
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="brand-button-secondary px-5 py-3 text-sm"
              >
                Try Again
              </button>
            }
          />
        </div>
      ) : filteredColleges.length === 0 ? (
        <div className="brand-panel p-8">
          <EmptyStatePanel
            title="No institutes match that search"
            description="Try a broader search term to explore the leaderboard again."
            icon={
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            }
            action={
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="brand-button-secondary px-5 py-3 text-sm"
              >
                Clear Search
              </button>
            }
          />
        </div>
      ) : (
        <div className="brand-panel-light px-7 py-7 sm:px-8">
          <div className="mb-6 flex flex-col gap-2">
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#666666]">
              Ranked Institutes
            </div>
            <h2 className="text-[2.4rem] font-semibold text-[#f0f0f0]">
              Public leaderboard
            </h2>
          </div>
          <div className="space-y-4">
            {filteredColleges.map((college) => (
              <div
                key={`${college.slug ?? college.instituteName}-${college.rank}`}
                className="grid gap-5 rounded-xl border border-white/[0.08] bg-[#2a2a2a] p-5 shadow-[0_12px_30px_rgba(8,12,20,0.06)] lg:grid-cols-[88px_1.15fr_0.95fr_auto]"
              >
                <div className="flex flex-col justify-center rounded-xl bg-[#1a1a1a] px-4 py-4 text-center text-[#f0f0f0]">
                  <div className="text-[11px] uppercase tracking-[0.26em] text-[#a0a0a0]">
                    Rank
                  </div>
                  <div className="mt-2 text-[2.2rem]">#{college.rank}</div>
                </div>

                <div className="min-w-0">
                  <h3 className="text-[2rem] font-semibold leading-none text-[#f0f0f0] [overflow-wrap:anywhere]">
                    {college.instituteName}
                  </h3>
                  <p className="mt-2 text-sm text-[#a0a0a0]">
                    {college.slug ?? "Institute slug unavailable"}
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.24em] text-[#666666]">
                        Certificates
                      </div>
                      <div className="mt-2 text-lg font-semibold text-[#f0f0f0]">
                        {college.mintedCertificates}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.24em] text-[#666666]">
                        Students
                      </div>
                      <div className="mt-2 text-lg font-semibold text-[#f0f0f0]">
                        {college.uniqueStudents}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.24em] text-[#666666]">
                        Last Mint
                      </div>
                      <div className="mt-2 text-sm font-semibold text-[#f0f0f0]">
                        {formatDateTime(college.lastMintedAt)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-[#666666]">
                      <span>Share of total EDU</span>
                      <span>
                        {totals.totalEduMinted > 0
                          ? `${Math.round(
                              (college.totalEduMinted / totals.totalEduMinted) * 100
                            )}%`
                          : "0%"}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#dfe6ef]">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#4f7ef5,#6fa8f8)]"
                        style={{
                          width: `${
                            totals.totalEduMinted > 0
                              ? Math.max(
                                  10,
                                  Math.round(
                                    (college.totalEduMinted / totals.totalEduMinted) * 100
                                  )
                                )
                              : 10
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-center rounded-xl border border-white/[0.06] bg-[#222222] px-4 py-4 text-center">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-[#666666]">
                    EDU Minted
                  </div>
                  <div className="mt-2 text-[2.2rem] text-[#f0f0f0]">
                    {college.totalEduMinted.toLocaleString()}
                  </div>
                  <div className="mt-3 text-sm text-[#a0a0a0]">
                    {college.mintedCertificates > 0
                      ? `${Math.round(
                          college.totalEduMinted / college.mintedCertificates
                        )} EDU per credential`
                      : "No minted credentials yet"}
                  </div>
                </div>

                <div className="flex items-center">
                  {college.slug ? (
                    <Link
                      href={`/colleges/${college.slug}`}
                      className="inline-flex rounded-full bg-[#1a1a1a] px-5 py-3 text-sm font-semibold text-[#f0f0f0] transition hover:bg-[#172136]"
                    >
                      View Profile
                    </Link>
                  ) : (
                    <span className="brand-chip-light">Profile unavailable</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageLayout>
  )
}
