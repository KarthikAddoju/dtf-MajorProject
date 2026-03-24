import { PageLayout } from "@/components/PageLayout"
import { SkeletonBlock } from "@/components/SkeletonBlock"

export default function InstituteProfileLoading() {
  return (
    <PageLayout>
      <SkeletonBlock variant="card" lines={5} />
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-5">
        <SkeletonBlock variant="metric" />
        <SkeletonBlock variant="metric" />
        <SkeletonBlock variant="metric" />
        <SkeletonBlock variant="metric" />
        <SkeletonBlock variant="metric" />
      </div>
      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SkeletonBlock variant="card" lines={4} />
        <SkeletonBlock variant="card" lines={4} />
      </div>
    </PageLayout>
  )
}
