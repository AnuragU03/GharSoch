export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="h-3 w-24 animate-pulse rounded-full bg-surface-2" />
        <div className="h-8 w-64 animate-pulse rounded-[10px] bg-surface-2" />
        <div className="h-4 w-[32rem] max-w-full animate-pulse rounded-full bg-surface-2" />
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border border-hairline bg-hairline md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="space-y-3 bg-surface px-4 py-4">
            <div className="h-3 w-20 animate-pulse rounded-full bg-surface-2" />
            <div className="h-6 w-16 animate-pulse rounded-[8px] bg-surface-2" />
            <div className="h-3 w-12 animate-pulse rounded-full bg-surface-2" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="space-y-4 rounded-[16px] border border-hairline bg-surface p-[18px]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-3">
                <div className="h-5 w-40 animate-pulse rounded-[8px] bg-surface-2" />
                <div className="h-4 w-full animate-pulse rounded-full bg-surface-2" />
                <div className="h-4 w-4/5 animate-pulse rounded-full bg-surface-2" />
              </div>
              <div className="h-9 w-9 animate-pulse rounded-[10px] bg-surface-2" />
            </div>

            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, counterIndex) => (
                <div key={counterIndex} className="space-y-2 rounded-[8px] bg-surface-2 p-3">
                  <div className="h-3 w-10 animate-pulse rounded-full bg-surface-3" />
                  <div className="h-5 w-8 animate-pulse rounded-[6px] bg-surface-3" />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-hairline pt-3">
              <div className="h-4 w-28 animate-pulse rounded-full bg-surface-2" />
              <div className="h-5 w-20 animate-pulse rounded-full bg-surface-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
