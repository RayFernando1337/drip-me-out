export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Image skeleton */}
        <div className="relative w-full aspect-square bg-muted rounded-lg animate-pulse">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-current"></div>
              <span className="text-sm">Loading image...</span>
            </div>
          </div>
        </div>
        
        {/* Button skeleton */}
        <div className="mt-6 text-center">
          <div className="h-10 w-32 bg-muted rounded-md animate-pulse mx-auto"></div>
        </div>
      </div>
    </div>
  );
}