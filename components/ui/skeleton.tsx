import { cn } from "@/lib/utils"; // Make sure this utility function is correctly imported and works

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-gray-700/50", className)} // Using bg-gray-700/50 to match your current popover styling
      {...props}
    />
  );
}

export { Skeleton };

// New skeleton components for specific items
export function RoomSkeleton() {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg">
      <div className="flex items-center gap-1 w-3/4">
        <Skeleton className="h-4 w-full" />
      </div>
      <Skeleton className="h-8 w-16" />
    </div>
  );
}

export function UserSkeleton() {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div>
          <Skeleton className="h-3 w-20 mb-1" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-4 w-4" />
    </div>
  );
}

interface SkeletonListProps {
  count: number;
  type: "room" | "user";
}

export function SkeletonList({ count, type }: SkeletonListProps) {
  return (
    <ul className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <li key={index}>
          {type === "room" ? <RoomSkeleton /> : <UserSkeleton />}
        </li>
      ))}
    </ul>
  );
}
