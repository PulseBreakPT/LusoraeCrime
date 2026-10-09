import * as React from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowUpRight, Banknote, Crosshair, Map as MapIcon, Search, Skull, Users } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * BLACKLIST Workspace Navigation
 *
 * Former game Sheets are now actual menu regions — not dialogs, overlays or
 * focus traps. Existing panel APIs (Sheet/SheetContent/etc.) are preserved so
 * game mechanics and nested tabs continue to work without being rewritten.
 */
const WorkspaceContext = React.createContext(null);

const Sheet = ({ open, defaultOpen = false, onOpenChange, children }) => {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const isOpen = open === undefined ? internalOpen : open;
  const titleId = React.useId();
  const changeOpen = React.useCallback((next) => {
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  }, [open, onOpenChange]);

  return (
    <WorkspaceContext.Provider value={{ open: isOpen, changeOpen, titleId }}>
      {children}
    </WorkspaceContext.Provider>
  );
};

const cloneActivator = (children, callback, props = {}) => {
  if (React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      onClick: (event) => {
        children.props.onClick?.(event);
        if (!event.defaultPrevented) callback();
      },
    });
  }
  return null;
};

const SheetTrigger = React.forwardRef(({ asChild, children, ...props }, ref) => {
  const context = React.useContext(WorkspaceContext);
  if (asChild) return cloneActivator(children, () => context?.changeOpen(true), props);
  return <button type="button" ref={ref} {...props} onClick={() => context?.changeOpen(true)}>{children}</button>;
});
SheetTrigger.displayName = "SheetTrigger";

const SheetClose = React.forwardRef(({ asChild, children, onClick, ...props }, ref) => {
  const context = React.useContext(WorkspaceContext);
  if (asChild) return cloneActivator(children, () => context?.changeOpen(false), props);
  return <button type="button" ref={ref} {...props} onClick={(event) => {
    onClick?.(event);
    if (!event.defaultPrevented) context?.changeOpen(false);
  }}>{children}</button>;
});
SheetClose.displayName = "SheetClose";

const SheetPortal = ({ children }) => <>{children}</>;
const SheetOverlay = () => null;

const sections = [
  { id: "operations", label: "OPERAÇÕES", icon: Crosshair },
  { id: "teams", label: "EQUIPAS", icon: Users },
  { id: "empire", label: "FINANÇAS", icon: Banknote },
  { id: "world", label: "CIDADE", icon: MapIcon },
  { id: "intel", label: "INTEL", icon: Skull },
];

const navigate = (panel) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("sub:workspace:navigate", { detail: { panel } }));
  }
};

const SheetContent = React.forwardRef(({
  side = "right", className, children, onKeyDown, variant = "menu", ...props
}, ref) => {
  const context = React.useContext(WorkspaceContext);
  const closeRef = React.useRef(null);
  const isSearch = variant === "search";
  React.useEffect(() => {
    if (!context?.open) return undefined;
    const onEscape = (event) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        context.changeOpen(false);
      }
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [context?.open, context?.changeOpen]);

  React.useEffect(() => {
    if (!context?.open || isSearch) return;
    const raf = requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(raf);
  }, [context?.open, isSearch]);

  if (!context?.open || typeof document === "undefined") return null;

  const workspace = (
    <section
      ref={ref}
      role="region"
      aria-labelledby={context.titleId}
      data-noir-workspace={variant}
      data-side={side}
      tabIndex={-1}
      className={cn("noir-workspace-menu sub-sheet-panel sub-panel", isSearch && "noir-workspace-search", className)}
      onKeyDown={onKeyDown}
      {...props}
    >
      <div className="noir-workspace-chrome">
        <button ref={closeRef} type="button" className="noir-workspace-back"
          onClick={() => context.changeOpen(false)}
          aria-label="Fechar menu e voltar ao centro de comando">
          <ArrowLeft size={19} strokeWidth={1.8}/><span>VOLTAR</span>
        </button>
        <span className="noir-workspace-brand">SUB<span>MUNDO</span><small>/ BLACKLIST OS</small></span>
        <button type="button" className="noir-workspace-map" onClick={() => navigate("map")}>
          <MapIcon size={15}/> <span>MAPA TÁTICO</span><ArrowUpRight size={14}/>
        </button>
      </div>
      {!isSearch && (
        <nav className="noir-workspace-tabs" aria-label="Aceder a outro menu">
          {sections.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => navigate(id)}>
              <Icon size={14}/><span>{label}</span>
            </button>
          ))}
          <button type="button" onClick={() => navigate("search")}>
            <Search size={14}/><span>PESQUISAR</span>
          </button>
        </nav>
      )}
      <div className="noir-workspace-scroll sub-sheet-scroll">
        {children}
      </div>
      <div className="noir-workspace-footnote" aria-hidden="true">
        <span>SUBMUNDO / SISTEMAS DA ORGANIZAÇÃO</span>
        <span>COMANDO PRIVADO • PORTUGAL</span>
      </div>
    </section>
  );
  return createPortal(workspace, document.body);
});
SheetContent.displayName = "SheetContent";

const SheetHeader = ({ className, ...props }) => (
  <div className={cn(
    "sub-modal-header noir-workspace-section-head flex flex-col space-y-1 text-left",
    className,
  )} {...props}/>
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({ className, ...props }) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props}/>
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef(({ className, ...props }, ref) => {
  const context = React.useContext(WorkspaceContext);
  return <h2 ref={ref} id={context?.titleId} className={cn(
    "sub-modal-title sub-sheet-title font-display text-3xl font-bold uppercase tracking-[0.04em] text-foreground",
    className,
  )} {...props}/>;
});
SheetTitle.displayName = "SheetTitle";

const SheetDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p ref={ref} className={cn(
    "sub-sheet-description max-w-[50rem] text-sm leading-relaxed text-muted-foreground",
    className,
  )} {...props}/>
));
SheetDescription.displayName = "SheetDescription";

export {
  Sheet, SheetPortal, SheetOverlay, SheetTrigger, SheetClose, SheetContent,
  SheetHeader, SheetFooter, SheetTitle, SheetDescription,
};
