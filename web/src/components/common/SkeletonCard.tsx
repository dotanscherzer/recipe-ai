export default function SkeletonCard() {
  return (
    <div className="glass-card overflow-hidden animate-pulse">
      <div className="aspect-video bg-stone-200" />
      <div className="p-4 space-y-3">
        <div className="h-5 bg-stone-200 rounded w-3/4" />
        <div className="h-4 bg-stone-200 rounded w-full" />
        <div className="flex gap-3">
          <div className="h-4 bg-stone-200 rounded w-16" />
          <div className="h-4 bg-stone-200 rounded w-12" />
          <div className="h-4 bg-stone-200 rounded w-14" />
        </div>
      </div>
    </div>
  );
}
