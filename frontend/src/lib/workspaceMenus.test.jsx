import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../components/ui/sheet";

global.IS_REACT_ACT_ENVIRONMENT = true;

describe("BLACKLIST game menu architecture", () => {
  let host;
  let root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  function Demo() {
    const [open, setOpen] = useState(true);
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent data-testid="real-menu">
          <SheetHeader><SheetTitle>Menu de operações</SheetTitle></SheetHeader>
          <p>As operações existentes são acessíveis num menu.</p>
        </SheetContent>
      </Sheet>
    );
  }

  test("opens a real menu region with no modal or backdrop", async () => {
    await act(async () => root.render(<Demo />));
    const workspace = document.querySelector('[data-testid="real-menu"]');
    expect(workspace).not.toBeNull();
    expect(workspace.getAttribute("role")).toBe("region");
    expect(workspace.getAttribute("aria-labelledby")).toBeTruthy();
    expect(document.querySelector(".sub-modal-overlay")).toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(workspace.querySelector("h2")?.textContent).toBe("Menu de operações");
  });

  test("escape closes the menu without a focus trap", async () => {
    await act(async () => root.render(<Demo />));
    expect(document.querySelector('[data-testid="real-menu"]')).not.toBeNull();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(document.querySelector('[data-testid="real-menu"]')).toBeNull();
  });

  test("cross-menu navigation emits a semantic navigation intent", async () => {
    const listener = jest.fn();
    window.addEventListener("sub:workspace:navigate", listener);
    try {
      await act(async () => root.render(<Demo />));
      const buttons = [...document.querySelectorAll(".noir-workspace-tabs button")];
      const teams = buttons.find((b) => b.textContent.includes("EQUIPAS"));
      expect(teams).toBeDefined();
      await act(async () => teams.click());
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].detail.panel).toBe("teams");
    } finally {
      window.removeEventListener("sub:workspace:navigate", listener);
    }
  });

  test("back button dismisses the workspace", async () => {
    await act(async () => root.render(<Demo />));
    await act(async () => document.querySelector(".noir-workspace-back").click());
    expect(document.querySelector('[data-testid="real-menu"]')).toBeNull();
  });
});
