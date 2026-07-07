import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-red-500/50 bg-gradient-to-b from-red-600 to-red-800 font-semibold text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_18px_rgba(220,38,38,0.3)] hover:from-red-500 hover:to-red-700 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_0_26px_rgba(220,38,38,0.45)]",
        destructive:
          "border border-red-500/40 bg-gradient-to-b from-red-700 to-red-900 text-destructive-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] hover:from-red-600 hover:to-red-800",
        outline:
          "border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] hover:border-white/25 hover:from-white/[0.13] hover:to-white/[0.05] hover:text-white",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        success:
          "border border-emerald-500/50 bg-gradient-to-b from-emerald-500 to-emerald-700 font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_14px_rgba(16,185,129,0.25)] hover:from-emerald-400 hover:to-emerald-600 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_0_20px_rgba(16,185,129,0.4)]",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
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
