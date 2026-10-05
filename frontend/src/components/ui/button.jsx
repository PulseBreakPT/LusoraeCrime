import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "sub-btn relative isolate inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-45 disabled:saturate-[0.7] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "sub-btn-primary border border-red-500/45 bg-red-700 text-white shadow-[0_3px_10px_rgba(0,0,0,0.28)] hover:border-red-400/60 hover:bg-red-600 active:scale-[0.96]",
        destructive:
          "sub-btn-danger border border-red-500/35 bg-red-950/90 text-red-100 hover:border-red-400/50 hover:bg-red-900 active:scale-[0.96]",
        outline:
          "sub-btn-glass border border-white/10 bg-[#111114] text-zinc-200 hover:border-white/20 hover:bg-[#16161b] hover:text-white active:scale-[0.96]",
        secondary:
          "sub-btn-soft border border-white/10 bg-zinc-900/90 text-zinc-300 hover:border-white/20 hover:bg-zinc-800/90 hover:text-white active:scale-[0.96]",
        success:
          "sub-btn-success border border-emerald-500/40 bg-emerald-700 text-white shadow-[0_3px_10px_rgba(0,0,0,0.25)] hover:border-emerald-400/55 hover:bg-emerald-600 active:scale-[0.96]",
        warning:
          "sub-btn-warning border border-amber-500/35 bg-amber-950/80 text-amber-100 hover:border-amber-400/50 hover:bg-amber-900/85 active:scale-[0.96]",
        filter:
          "sub-btn-filter border border-white/10 bg-[#0d0d10] text-zinc-400 hover:border-white/20 hover:bg-[#111115] hover:text-white active:scale-[0.96] aria-[pressed=true]:border-red-500/30 aria-[pressed=true]:bg-red-500/[0.12] aria-[pressed=true]:text-red-200",
        ghost: "sub-btn-ghost border border-transparent text-zinc-300 hover:bg-white/[0.06] hover:text-white",
        link: "sub-btn-link text-red-400 underline-offset-4 hover:text-red-300 hover:underline",
        bare: "border border-transparent bg-transparent text-inherit shadow-none hover:bg-transparent hover:text-inherit",
      },
      size: {
        default: "h-11 px-4 py-2 sm:h-10",
        sm: "h-11 rounded-lg px-3 text-xs sm:h-9",
        compact: "h-9 rounded-lg px-2.5 text-[11px]",
        iconCompact: "h-9 w-9 rounded-lg p-0",
        lg: "h-12 rounded-lg px-8 sm:h-11",
        icon: "h-11 w-11 sm:h-10 sm:w-10",
        bare: "h-auto w-auto rounded-[inherit] p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, type, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
