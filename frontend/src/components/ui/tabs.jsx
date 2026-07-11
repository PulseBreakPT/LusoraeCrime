import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-center rounded-lg border border-white/10 bg-black/40 p-1 text-muted-foreground shadow-[inset_0_1px_5px_rgba(0,0,0,0.45)]",
      className
    )}
    {...props} />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex select-none items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-white/[0.06] hover:text-zinc-200 active:scale-[0.97] data-[state=active]:bg-gradient-to-b data-[state=active]:from-red-500 data-[state=active]:via-red-600 data-[state=active]:to-red-800 data-[state=active]:text-white data-[state=active]:ring-1 data-[state=active]:ring-inset data-[state=active]:ring-red-400/50 data-[state=active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-2px_5px_rgba(0,0,0,0.3),0_0_14px_rgba(220,38,38,0.45),0_2px_6px_rgba(0,0,0,0.4)]",
      className
    )}
    {...props} />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props} />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
