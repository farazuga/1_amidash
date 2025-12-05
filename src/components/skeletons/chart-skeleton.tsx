export function ChartSkeleton() {
  return (
    <div
      className="h-[300px] w-full animate-pulse rounded-lg bg-muted"
      role="status"
      aria-label="Loading chart"
    >
      <span className="sr-only">Loading chart...</span>
    </div>
  );
}
