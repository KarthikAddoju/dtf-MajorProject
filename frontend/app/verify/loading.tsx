import { PageLayout } from "@/components/PageLayout"
import { SkeletonBlock } from "@/components/SkeletonBlock"

export default function VerifyLoading() {
  return (
    <PageLayout>
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 text-center">
          <SkeletonBlock variant="badge" />
          <div className="mt-4">
            <SkeletonBlock variant="heading" />
          </div>
        </div>
        <div className="mx-auto max-w-3xl">
          <SkeletonBlock variant="card" lines={4} />
        </div>
      </div>
    </PageLayout>
  )
}
