import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

const Progress = React.forwardRef(({ className, value, indicatorClassName, indicatorStyle, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-white/[0.08] shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]",
      className
    )}
    {...props}>
    <ProgressPrimitive.Indicator
      className={cn("h-full w-full flex-1 bg-gradient-to-r from-red-700 via-red-500 to-red-400 shadow-[0_0_10px_rgba(220,38,38,0.4)] transition-all duration-500", indicatorClassName)}
      style={{ transform: `translateX(-${100 - (value || 0)}%)`, ...indicatorStyle }} />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
