export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-[#1e1e2e] rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-[#1e1e2e] rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-[#1e1e2e] rounded-xl" />
    </div>
  );
}
