import { PageLayout } from "@/components/PageLayout"
import { SkeletonBlock } from "@/components/SkeletonBlock"

export default function UploadLoading() {
  return (
    <PageLayout>
      <div className="mb-8 grid gap-8 xl:grid-cols-[1.08fr_0.92fr]">
        <SkeletonBlock variant="card" lines={6} />
        <SkeletonBlock variant="card" lines={5} />
      </div>
      <SkeletonBlock variant="card" lines={8} />
    </PageLayout>
  )
}
