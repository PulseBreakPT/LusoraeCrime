import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-gradient-to-b data-[state=checked]:from-red-500 data-[state=checked]:to-red-700 data-[state=checked]:shadow-[inset_0_1px_2px_rgba(0,0,0,0.3),0_0_10px_rgba(220,38,38,0.45)] data-[state=unchecked]:bg-white/10",
      className
    )}
    {...props}
    ref={ref}>
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full bg-zinc-100 shadow-[0_1px_3px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.8)] ring-0 transition-transform duration-200 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
      )} />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
