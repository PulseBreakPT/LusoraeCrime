import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "sub-shad-badge inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-red-500/30 bg-red-500/10 text-red-100 hover:bg-red-500/20",
        secondary:
          "border-white/10 bg-white/[0.055] text-zinc-200 hover:bg-white/[0.09]",
        destructive:
          "border-red-500/30 bg-red-950/80 text-red-200 hover:bg-red-900/80",
        outline: "border-white/15 bg-white/[0.03] text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
