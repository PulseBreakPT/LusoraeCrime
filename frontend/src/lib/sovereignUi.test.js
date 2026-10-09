import fs from "fs";
import path from "path";

const src = (name) => fs.readFileSync(path.join(process.cwd(), "src", name), "utf8");

describe("Sovereign UI contract", () => {
  const app = src("App.js");
  const css = src("sovereign-ui.css");
  const game = src("pages/GamePage.jsx");
  const auth = src("pages/AuthPage.jsx");

  test("the unified style layer loads after all historical skins", () => {
    expect(app).toContain('import "@/sovereign-ui.css";');
    expect(app.indexOf('import "@/sovereign-ui.css";')).toBeGreaterThan(
      app.indexOf('import "@/performance.css";')
    );
    expect(css).toContain("--so-surface:");
    expect(css).toContain("--so-border:");
  });

  test("navigation keeps all areas and exposes the current submenu", () => {
    for (const group of ["operations", "crew", "empire", "utilities"]) {
      expect(game).toContain(group + ': { title:');
    }
    expect(game).toContain('className="sub-nav-tray-heading"');
    expect(game).toContain('role="region"');
    expect(game).toContain('aria-expanded={expandable ? expanded : undefined}');
    expect(game).toContain('document.addEventListener("pointerdown", handlePointer)');
    expect(game).toContain('document.removeEventListener("pointerdown", handlePointer)');
    expect(game).toContain('document.removeEventListener("keydown", handleKey)');
  });

  test("the presentation supports touch, reduced motion and accessible focus", () => {
    expect(css).toContain("@media (pointer: coarse)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("html.sub-reduced-motion");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("@media (min-width: 1920px)");
  });

  test("entry and in-game panels use the same surface system", () => {
    expect(auth).toContain('className="sub-auth-shell');
    expect(auth).toContain('className="noir-access-card"');
    expect(auth).toContain('data-testid="google-sign-in-button"');
    expect(auth).toContain('data-testid="guest-play-button"');
    for (const selector of [".sub-sheet-panel", ".sub-menu-modal", ".sub-nav-tray", ".sub-auth-gate"]) {
      expect(css).toContain(selector);
    }
  });
});
