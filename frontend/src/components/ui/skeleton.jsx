import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}) {
  return (
    <div
      className={cn("sub-skeleton rounded-md bg-primary/10", className)}
      {...props} />
  );
}

export { Skeleton }
