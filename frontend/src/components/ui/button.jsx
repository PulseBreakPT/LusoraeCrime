import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "lus-btn relative isolate inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-50 disabled:saturate-[0.55] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "lus-btn-primary border border-red-400/40 bg-gradient-to-b from-red-500 via-red-600 to-red-800 font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-2px_6px_rgba(0,0,0,0.35),0_2px_10px_rgba(0,0,0,0.5),0_0_18px_rgba(220,38,38,0.32)] hover:from-red-400 hover:via-red-500 hover:to-red-700 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.32),inset_0_-2px_6px_rgba(0,0,0,0.28),0_5px_18px_rgba(0,0,0,0.55),0_0_30px_rgba(220,38,38,0.55)]",
        destructive:
          "lus-btn-danger border border-red-500/40 bg-gradient-to-b from-red-700 via-red-800 to-red-950 text-red-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.4),0_2px_10px_rgba(0,0,0,0.5)] hover:border-red-400/60 hover:from-red-600 hover:via-red-700 hover:to-red-900 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_4px_14px_rgba(0,0,0,0.55),0_0_20px_rgba(220,38,38,0.35)]",
        outline:
          "lus-btn-glass border border-white/10 bg-gradient-to-b from-white/[0.09] to-white/[0.02] text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_8px_rgba(0,0,0,0.35)] hover:border-white/25 hover:from-white/[0.14] hover:to-white/[0.05] hover:text-white hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.13),0_4px_14px_rgba(0,0,0,0.45)]",
        secondary:
          "lus-btn-soft border border-white/5 bg-zinc-900/80 text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_2px_8px_rgba(0,0,0,0.35)] hover:border-white/15 hover:bg-zinc-800/80 hover:text-white",
        success:
          "lus-btn-success border border-emerald-400/40 bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-800 font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-2px_6px_rgba(0,0,0,0.3),0_2px_10px_rgba(0,0,0,0.45),0_0_16px_rgba(16,185,129,0.28)] hover:from-emerald-400 hover:via-emerald-500 hover:to-emerald-700 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.32),0_5px_18px_rgba(0,0,0,0.5),0_0_26px_rgba(16,185,129,0.5)]",
        ghost: "lus-btn-ghost text-zinc-300 hover:bg-white/[0.07] hover:text-white",
        link: "lus-btn-link text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
