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
      "fixed inset-0 z-50 bg-black/70 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-200",
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
  "fixed z-50 gap-4 bg-background p-4 pt-5 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:duration-300 data-[state=closed]:duration-200 sm:p-6",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
        left: "inset-y-0 left-0 h-full w-full border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left sm:w-[27rem] sm:max-w-[92vw] lg:w-[30rem]",
        right:
          "inset-y-0 right-0 h-full w-full border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right sm:w-[27rem] sm:max-w-[92vw] lg:w-[30rem]",
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
    <SheetPrimitive.Content ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
      <SheetPrimitive.Close
        className="absolute right-4 top-4 z-10 rounded-full border border-white/10 bg-white/[0.06] p-1.5 text-zinc-400 transition-colors hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-ring disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
      {children}
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
      "relative -mx-4 mb-1 flex flex-col space-y-1.5 border-b border-white/[0.07] bg-gradient-to-b from-white/[0.025] to-transparent px-4 pb-4 pl-[19px] text-left before:absolute before:left-2.5 before:top-1 before:h-[calc(100%-1.5rem)] before:w-[3px] before:rounded-full before:bg-gradient-to-b before:from-red-500 before:to-red-800 before:shadow-[0_0_10px_rgba(220,38,38,0.6)] before:content-[''] sm:-mx-6 sm:px-6 sm:pl-[27px] sm:before:left-4",
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
    className={cn("lus-sheet-title font-display text-xl font-bold uppercase tracking-wider text-foreground", className)}
    {...props} />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-[12px] leading-snug text-muted-foreground", className)}
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
