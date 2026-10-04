import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva } from "class-variance-authority";
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/20 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-200",
      className
    )}
    {...props}
    ref={ref} />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

// Largura ÚNICA e consistente para todos os painéis laterais do jogo:
// full-width em mobile, 27rem em tablet, 30rem em desktop — os painéis
// não devem sobrepor larguras próprias (organização > improviso).
const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-4 pt-0 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:duration-300 data-[state=closed]:duration-200 sm:p-6 sm:pt-0",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
        left: "inset-y-0 left-0 h-full w-full border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left sm:w-[27rem] sm:max-w-[92vw] lg:w-[30rem]",
        right:
          "inset-x-2 bottom-[4.9rem] max-h-[calc(100dvh-6rem)] w-auto rounded-2xl border data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:slide-out-to-bottom-3 sm:inset-x-auto sm:left-1/2 sm:right-auto sm:bottom-[4.9rem] sm:h-auto sm:max-h-[min(76vh,46rem)] sm:w-[min(34rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:border",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

const SheetContent = React.forwardRef(({ side = "right", className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content ref={ref} className={cn(sheetVariants({ side }), side === "right" && "sub-sheet-panel", className)} {...props}>
      <SheetPrimitive.Close
        className="sub-sheet-close absolute right-3 top-3 z-30 flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-transparent p-0 text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-white focus:outline-none focus:ring-1 focus:ring-white/20 disabled:pointer-events-none sm:right-4">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
      <div className="sub-sheet-scroll">
        {children}
      </div>
    </SheetPrimitive.Content>
  </SheetPortal>
))
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}) => (
  <div
    className={cn(
      "sticky top-0 z-20 -mx-4 mb-3 flex flex-col space-y-1 border-b border-white/[0.065] bg-[#0b0b0e] px-4 pb-3.5 pr-12 pt-4 text-left sm:-mx-6 sm:px-6 sm:pr-14",
      className
    )}
    {...props} />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
  className,
  ...props
}) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props} />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("sub-sheet-title font-display text-[17px] font-bold uppercase tracking-[0.04em] text-foreground sm:text-lg", className)}
    {...props} />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("sub-sheet-description max-w-[34rem] text-[10.5px] leading-relaxed text-muted-foreground", className)}
    {...props} />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
