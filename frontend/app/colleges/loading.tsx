import { PageLayout } from "@/components/PageLayout"
import { SkeletonBlock } from "@/components/SkeletonBlock"

export default function CollegesLoading() {
  return (
    <PageLayout>
      <div className="mb-10 grid gap-8 xl:grid-cols-[1.08fr_0.92fr]">
        <SkeletonBlock variant="card" lines={6} />
        <SkeletonBlock variant="card" lines={5} />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <SkeletonBlock variant="metric" />
        <SkeletonBlock variant="metric" />
        <SkeletonBlock variant="metric" />
      </div>
      <div className="mt-8">
        <SkeletonBlock variant="card" lines={4} />
      </div>
    </PageLayout>
  )
}
