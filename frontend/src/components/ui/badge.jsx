import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-red-500/40 bg-gradient-to-b from-red-600 to-red-800 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_0_10px_rgba(220,38,38,0.25)] hover:from-red-500 hover:to-red-700",
        secondary:
          "border-white/10 bg-white/[0.07] text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:bg-white/[0.12]",
        destructive:
          "border-red-500/40 bg-red-950/80 text-red-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-red-900/80",
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
