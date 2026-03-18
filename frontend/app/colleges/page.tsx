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
          <div className="mt-6 text-[11px] uppercase tracking-[0.34em] text-[#4f5966]">
            Public / rankings / network momentum
          </div>
          <h1 className="display-serif mt-4 max-w-4xl text-5xl font-semibold leading-[0.95] text-[#101828] sm:text-6xl">
            Rank institutes by real credential issuance, not brochure claims.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#243246]">
            The college index translates on-chain EDU rewards and minted credential
            activity into a public trust scoreboard for institutes, students, and
            external verifiers.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[24px_12px_24px_12px] border border-[#101828]/12 bg-[rgba(255,255,255,0.82)] p-5">
              <div className="text-[11px] uppercase tracking-[0.26em] text-[#4d596d]">
                Active Institutes
              </div>
              <div className="display-serif mt-3 text-[2rem] text-[#101828]">
                {colleges.length}
              </div>
            </div>
            <div className="rounded-[24px_12px_24px_12px] border border-[#101828]/12 bg-[rgba(255,255,255,0.82)] p-5">
              <div className="text-[11px] uppercase tracking-[0.26em] text-[#4d596d]">
                Verified Students
              </div>
              <div className="display-serif mt-3 text-[2rem] text-[#101828]">
                {totals.totalStudents.toLocaleString()}
              </div>
            </div>
            <div className="rounded-[24px_12px_24px_12px] border border-[#101828]/12 bg-[rgba(255,255,255,0.82)] p-5">
              <div className="text-[11px] uppercase tracking-[0.26em] text-[#4d596d]">
                Live Search
              </div>
              <div className="display-serif mt-3 text-[2rem] text-[#101828]">
                {filteredColleges.length}
              </div>
            </div>
          </div>
        </div>

        <div className="brand-panel p-7">
          <div className="text-[11px] uppercase tracking-[0.3em] text-[#8bbbd5]">
            Leaderboard Logic
          </div>
          <h2 className="display-serif mt-2 text-[2.1rem] font-semibold text-[#f7efe3]">
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
                className="grid gap-3 rounded-[22px_12px_22px_12px] border border-[#eedfce]/10 bg-[rgba(255,255,255,0.03)] p-4 sm:grid-cols-[40px_1fr]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-[#f2e7d7] text-sm font-semibold text-[#101828]">
                  {index + 1}
                </div>
                <p className="self-center text-[#d8e0ec]">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <MetricCard
          title="Total EDU Minted"
          value={<span className="text-[#ffe2af]">{totals.totalEduMinted.toLocaleString()} EDU</span>}
          accentColor="yellow"
        />
        <MetricCard
          title="Certificates Minted"
          value={<span className="text-[#d5e7f1]">{totals.totalCertificates.toLocaleString()}</span>}
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
              className="mb-2 block text-sm font-medium text-[#c8d0de]"
            >
              Search Institutes
            </label>
            <input
              id="collegeSearch"
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by institute name or slug"
              className="w-full rounded-[20px] border border-[#eedfce]/12 bg-[rgba(255,255,255,0.04)] px-4 py-3 text-[#f7efe3] placeholder:text-[#8ea0b8] focus:border-[#d25b36]/40 focus:outline-none"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[#8ea0b8]">
                Search updates live across institute names and public slugs.
              </p>
              {searchQuery.trim() ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="rounded-full border border-[#eedfce]/12 bg-[rgba(255,255,255,0.05)] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-[#f7efe3] transition hover:bg-[rgba(255,255,255,0.1)]"
                >
                  Clear Search
                </button>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col justify-end">
            <div className="rounded-[20px] border border-[#eedfce]/10 bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[#c8d0de]">
              Showing {filteredColleges.length} of {colleges.length} institutes
            </div>
          </div>
        </div>
      </div>

      {!isLoading && !errorMessage ? (
        <div className="mb-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr] xl:items-start">
          <div className="brand-panel p-7">
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#8bbbd5]">
              Leaderboard Insight
            </div>
            <h2 className="display-serif mt-2 text-[2.1rem] font-semibold text-[#f7efe3]">
              One primary story from the network.
            </h2>
            <p className="mt-4 max-w-3xl text-[#c8d0de]">{leaderboardInsight}</p>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[22px_12px_22px_12px] border border-[#eedfce]/10 bg-[rgba(255,255,255,0.03)] p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#8ea0b8]">
                  Average EDU / institute
                </div>
                <div className="display-serif mt-2 text-[2rem] text-[#f7efe3]">
                  {chartAverage.toLocaleString()}
                </div>
              </div>
              <div className="rounded-[22px_12px_22px_12px] border border-[#eedfce]/10 bg-[rgba(255,255,255,0.03)] p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#8ea0b8]">
                  Search coverage
                </div>
                <div className="display-serif mt-2 text-[2rem] text-[#f7efe3]">
                  {filteredColleges.length}/{colleges.length}
                </div>
              </div>
              <div className="rounded-[22px_12px_22px_12px] border border-[#eedfce]/10 bg-[rgba(255,255,255,0.03)] p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#8ea0b8]">
                  Leader share
                </div>
                <div className="display-serif mt-2 text-[2rem] text-[#f7efe3]">
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
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#6f563f]">
              Featured Institute
            </div>
            <h2 className="display-serif mt-2 text-[3rem] font-semibold leading-[0.95] text-[#101828]">
              {featuredCollege.instituteName}
            </h2>
            <p className="mt-4 max-w-2xl text-[#243246]">
              Ranked #{featuredCollege.rank} with{" "}
              {featuredCollege.totalEduMinted.toLocaleString()} EDU minted across{" "}
              {featuredCollege.mintedCertificates} verified credentials.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[22px_12px_22px_12px] border border-[#101828]/12 bg-[rgba(255,255,255,0.82)] p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#4d596d]">
                  Rank
                </div>
                <div className="display-serif mt-2 text-[2rem] text-[#101828]">
                  #{featuredCollege.rank}
                </div>
              </div>
              <div className="rounded-[22px_12px_22px_12px] border border-[#101828]/12 bg-[rgba(255,255,255,0.82)] p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#4d596d]">
                  EDU Minted
                </div>
                <div className="display-serif mt-2 text-[2rem] text-[#101828]">
                  {featuredCollege.totalEduMinted.toLocaleString()}
                </div>
              </div>
              <div className="rounded-[22px_12px_22px_12px] border border-[#101828]/12 bg-[rgba(255,255,255,0.82)] p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#4d596d]">
                  Last Minted
                </div>
                <div className="mt-2 text-sm font-semibold text-[#101828]">
                  {formatDateTime(featuredCollege.lastMintedAt)}
                </div>
              </div>
            </div>

            {featuredCollege.slug ? (
              <div className="mt-6">
                <Link
                  href={`/colleges/${featuredCollege.slug}`}
                  className="inline-flex rounded-full bg-[#101828] px-5 py-3 text-sm font-semibold text-[#f7efe3] transition hover:bg-[#172136]"
                >
                  Open Institute Profile
                </Link>
              </div>
            ) : null}
          </div>

          <div className="brand-panel p-7">
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#f5c88a]">
              Ranking Snapshot
            </div>
            <h2 className="display-serif mt-2 text-[2.1rem] font-semibold text-[#f7efe3]">
              Public momentum, captured in one glance.
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[22px_12px_22px_12px] border border-[#eedfce]/10 bg-[rgba(255,255,255,0.03)] p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#8ea0b8]">
                  Leading Share
                </div>
                <div className="display-serif mt-2 text-[2.2rem] text-[#f7efe3]">
                  {leadingShare !== null ? `${leadingShare}%` : "Pending"}
                </div>
              </div>
              <div className="rounded-[22px_12px_22px_12px] border border-[#eedfce]/10 bg-[rgba(255,255,255,0.03)] p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#8ea0b8]">
                  Recent Leader
                </div>
                <div className="mt-2 text-sm font-semibold text-[#f7efe3]">
                  {overview?.leadInstituteName ?? "No live leader yet"}
                </div>
              </div>
              <div className="rounded-[22px_12px_22px_12px] border border-[#eedfce]/10 bg-[rgba(255,255,255,0.03)] p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#8ea0b8]">
                  Certificates
                </div>
                <div className="display-serif mt-2 text-[2.2rem] text-[#f7efe3]">
                  {totals.totalCertificates.toLocaleString()}
                </div>
              </div>
              <div className="rounded-[22px_12px_22px_12px] border border-[#eedfce]/10 bg-[rgba(255,255,255,0.03)] p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#8ea0b8]">
                  Students
                </div>
                <div className="display-serif mt-2 text-[2.2rem] text-[#f7efe3]">
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
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#8bbbd5]">
              Network Momentum
            </div>
            <h2 className="display-serif mt-2 text-[2.1rem] font-semibold text-[#f7efe3]">
              EDU minting performance
            </h2>

            <div className="mt-6 h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid stroke="rgba(255, 255, 255, 0.08)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#9db0c8"
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                  />
                  <YAxis
                    stroke="#9db0c8"
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={{
                      background: "#0f1726",
                      border: "1px solid rgba(237,223,206,0.12)",
                      borderRadius: "18px",
                      color: "#f7efe3",
                    }}
                  />
                  <Bar
                    dataKey="totalEduMinted"
                    fill="url(#eduGradient)"
                    radius={[16, 16, 0, 0]}
                  />
                  <defs>
                    <linearGradient id="eduGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#d25b36" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#8bbbd5" stopOpacity={0.9} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px_12px_22px_12px] border border-[#eedfce]/10 bg-[rgba(255,255,255,0.03)] p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#8ea0b8]">
                  Chart reading
                </div>
                <p className="mt-2 text-sm leading-6 text-[#d8e0ec]">
                  Bars compare EDU minted by the top visible institutes in the current search result.
                </p>
              </div>
              <div className="rounded-[22px_12px_22px_12px] border border-[#eedfce]/10 bg-[rgba(255,255,255,0.03)] p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#8ea0b8]">
                  Visible slice
                </div>
                <p className="mt-2 text-sm leading-6 text-[#d8e0ec]">
                  The chart shows up to six institutes at a time so labels stay readable and comparable.
                </p>
              </div>
            </div>
          </div>

          <div className="brand-panel-light px-8 py-7">
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#6f563f]">
              Recent Verified Credentials
            </div>
            <h2 className="display-serif mt-2 text-[2.1rem] font-semibold text-[#101828]">
              Fresh proof from the network
            </h2>
            {overview.recentActivity.length === 0 ? (
              <div className="mt-6 rounded-[24px_12px_24px_12px] border border-[#101828]/12 bg-[rgba(255,255,255,0.82)] p-6 text-center text-[#243246]">
                The colleges index will show recent mint activity here once new
                credentials are issued.
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {overview.recentActivity.slice(0, 4).map((activity) => (
                  <div
                    key={activity.id}
                    className="rounded-[24px_12px_24px_12px] border border-[#101828]/12 bg-[rgba(255,255,255,0.82)] p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-[11px] uppercase tracking-[0.26em] text-[#5f7f68]">
                          {activity.tokenId ? `Token #${activity.tokenId}` : "Minted Record"}
                        </div>
                        <div className="mt-2 display-serif text-[1.55rem] font-semibold text-[#101828] [overflow-wrap:anywhere]">
                          {activity.courseName}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <div className="text-sm text-[#425168]">
                            {activity.instituteName}
                          </div>
                          <div className="rounded-full border border-[#b8892d]/20 bg-[#b8892d]/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#6f563f]">
                            {formatCredentialTypeLabel(activity.credentialType)}
                          </div>
                        </div>
                      </div>
                      <div className="rounded-full border border-[#8bbbd5]/24 bg-[#8bbbd5]/12 px-3 py-1 text-xs font-medium text-[#345166]">
                        {activity.eduAmount !== null
                          ? `${activity.eduAmount.toLocaleString()} EDU`
                          : "Reward pending"}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                      <span className="font-mono text-[#345166]">
                        {truncateValue(activity.studentAddress, 10, 8)}
                      </span>
                      <span className="text-[#425168]">
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
        <div className="brand-panel p-8">
          <div className="py-12 text-center text-[#c8d0de]">
            Building the college leaderboard...
          </div>
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
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#6f563f]">
              Ranked Institutes
            </div>
            <h2 className="display-serif text-[2.4rem] font-semibold text-[#101828]">
              Public leaderboard
            </h2>
          </div>
          <div className="space-y-4">
            {filteredColleges.map((college) => (
              <div
                key={`${college.slug ?? college.instituteName}-${college.rank}`}
                className="grid gap-5 rounded-[28px_14px_28px_14px] border border-[#101828]/12 bg-[rgba(255,255,255,0.82)] p-5 shadow-[0_12px_30px_rgba(8,12,20,0.06)] lg:grid-cols-[88px_1.15fr_0.95fr_auto]"
              >
                <div className="flex flex-col justify-center rounded-[20px_10px_20px_10px] bg-[#101828] px-4 py-4 text-center text-[#f7efe3]">
                  <div className="text-[11px] uppercase tracking-[0.26em] text-[#9db0c8]">
                    Rank
                  </div>
                  <div className="display-serif mt-2 text-[2.2rem]">#{college.rank}</div>
                </div>

                <div className="min-w-0">
                  <h3 className="display-serif text-[2rem] font-semibold leading-none text-[#101828] [overflow-wrap:anywhere]">
                    {college.instituteName}
                  </h3>
                  <p className="mt-2 text-sm text-[#425168]">
                    {college.slug ?? "Institute slug unavailable"}
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.24em] text-[#4d596d]">
                        Certificates
                      </div>
                      <div className="mt-2 text-lg font-semibold text-[#101828]">
                        {college.mintedCertificates}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.24em] text-[#4d596d]">
                        Students
                      </div>
                      <div className="mt-2 text-lg font-semibold text-[#101828]">
                        {college.uniqueStudents}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.24em] text-[#4d596d]">
                        Last Mint
                      </div>
                      <div className="mt-2 text-sm font-semibold text-[#101828]">
                        {formatDateTime(college.lastMintedAt)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-[#4d596d]">
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
                        className="h-full rounded-full bg-[linear-gradient(90deg,#d25b36,#8bbbd5)]"
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

                <div className="flex flex-col justify-center rounded-[20px_10px_20px_10px] border border-[#101828]/10 bg-[rgba(255,255,255,0.55)] px-4 py-4 text-center">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-[#4d596d]">
                    EDU Minted
                  </div>
                  <div className="display-serif mt-2 text-[2.2rem] text-[#101828]">
                    {college.totalEduMinted.toLocaleString()}
                  </div>
                  <div className="mt-3 text-sm text-[#425168]">
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
                      className="inline-flex rounded-full bg-[#101828] px-5 py-3 text-sm font-semibold text-[#f7efe3] transition hover:bg-[#172136]"
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
