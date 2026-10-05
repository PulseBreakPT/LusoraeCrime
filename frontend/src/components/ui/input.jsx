import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, size = "default", ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex w-full rounded-lg border border-input bg-[#0d0d10] shadow-none transition-[border-color,background-color,color,box-shadow] duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-red-500/50 focus-visible:ring-2 focus-visible:ring-red-500/20 disabled:cursor-not-allowed disabled:opacity-50",
        size === "compact"
          ? "h-9 px-2.5 py-1.5 text-[11px]"
          : "h-11 px-3 py-2 text-base md:h-10 md:text-sm",
        className
      )}
      ref={ref}
      {...props} />
  );
})
Input.displayName = "Input"

export { Input }
