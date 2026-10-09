import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Sheet as Dialog, SheetTrigger as DialogTrigger,
  SheetPortal as DialogPortal, SheetOverlay as DialogOverlay,
  SheetClose as DialogClose, SheetContent,
  SheetHeader as DialogHeader, SheetFooter as DialogFooter,
  SheetTitle as DialogTitle, SheetDescription as DialogDescription,
} from "./sheet";

/** Search/command dialogs are dedicated workspace menus, not modal overlays. */
const DialogContent = React.forwardRef(({ className, overlayClassName, ...props }, ref) => (
  <SheetContent
    ref={ref}
    variant="search"
    className={cn("sub-menu-modal noir-command-search-menu", className)}
    {...props}
  />
));
DialogContent.displayName = "DialogContent";

export {
  Dialog, DialogPortal, DialogOverlay, DialogTrigger, DialogClose,
  DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
};
