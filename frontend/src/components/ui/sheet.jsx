import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Sheet = SheetPrimitive.Root
const SheetTrigger = SheetPrimitive.Trigger
const SheetClose = SheetPrimitive.Close
const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "sub-modal-overlay fixed inset-0 z-50 bg-black/65 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-150",
      className
    )}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

// Os módulos principais do SUBMUNDO usam side="right", mas "right" significa
// a shell modal central definida em DESIGN.md. As restantes variantes ficam
// disponíveis para superfícies auxiliares que precisem de um sheet real.
const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-4 pt-0 shadow-lg transition ease-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:duration-180 data-[state=closed]:duration-150 sm:p-6 sm:pt-0",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top",
        bottom: "inset-x-0 bottom-0 border-t data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
        left: "inset-y-0 left-0 h-full w-full border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left sm:w-[27rem] sm:max-w-[92vw] lg:w-[30rem]",
        right: "left-1/2 top-1/2 rounded-2xl border data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
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
    <SheetPrimitive.Content
      ref={ref}
      className={cn(sheetVariants({ side }), side === "right" && "sub-sheet-panel", className)}
      {...props}
    >
      <SheetPrimitive.Close
        aria-label="Fechar"
        className="sub-sheet-close absolute right-2 top-2 z-30 flex h-11 w-11 items-center justify-center rounded-xl border border-transparent bg-transparent p-0 text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 disabled:pointer-events-none sm:right-3 sm:top-2.5"
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Fechar</span>
      </SheetPrimitive.Close>
      <div className="sub-sheet-scroll">
        {children}
      </div>
    </SheetPrimitive.Content>
  </SheetPortal>
))
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({ className, ...props }) => (
  <div
    className={cn(
      "sub-modal-header sticky top-0 z-20 -mx-4 mb-3 flex flex-col space-y-1 border-b border-white/[0.065] bg-[#0b0b0e] px-4 pb-3.5 pr-14 pt-4 text-left sm:-mx-6 sm:px-6 sm:pr-16",
      className
    )}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({ className, ...props }) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("sub-modal-title sub-sheet-title font-display text-[17px] font-bold uppercase tracking-[0.04em] text-foreground", className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("sub-sheet-description max-w-[36rem] text-[11px] leading-relaxed text-muted-foreground", className)}
    {...props}
  />
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
