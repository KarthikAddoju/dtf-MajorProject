import { PageLayout } from "@/components/PageLayout"
import { SkeletonBlock } from "@/components/SkeletonBlock"

export default function DashboardLoading() {
  return (
    <PageLayout>
      <div className="mb-8">
        <SkeletonBlock variant="heading" />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <SkeletonBlock variant="metric" />
        <SkeletonBlock variant="metric" />
        <SkeletonBlock variant="metric" />
        <SkeletonBlock variant="metric" />
      </div>
      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SkeletonBlock variant="card" lines={5} />
        <SkeletonBlock variant="card" lines={4} />
      </div>
      <div className="mt-6">
        <SkeletonBlock variant="card" lines={6} />
      </div>
    </PageLayout>
  )
}
