import { PageLayout } from "@/components/PageLayout"
import { SkeletonBlock } from "@/components/SkeletonBlock"

export default function AdminLoading() {
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
      <div className="mt-8">
        <SkeletonBlock variant="card" lines={6} />
      </div>
      <div className="mt-6">
        <SkeletonBlock variant="card" lines={5} />
      </div>
    </PageLayout>
  )
}
