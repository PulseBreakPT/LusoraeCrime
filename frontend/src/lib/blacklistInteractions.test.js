import fs from "fs";
import path from "path";

const read = (relative) =>
  fs.readFileSync(path.join(process.cwd(), "src", relative), "utf8");

describe("BLACKLIST / consistent interactions and direct entry", () => {
  const app = read("App.js");
  const access = read("pages/AuthPage.jsx");
  const loading = read("components/LoadingScreen.jsx");
  const boot = read("context/AuthContextV2.js");
  const controls = read("components/ui/button.jsx");
  const sonner = read("components/ui/sonner.jsx");
  const css = read("noir-interactions.css");

  test("never mounts the former cinematic startup screen", () => {
    expect(app).not.toMatch(/<BootScreen\b/);
    expect(app).not.toMatch(/import.*BootScreen/);
    expect(loading).not.toContain("TacticalRadar");
    expect(loading).not.toContain("FlavorRotator");
    expect(loading).not.toContain("LoadingBackdrop");
    expect(loading).toContain('data-testid="inline-loading-status"');
  });

  test("login shows direct functional account and guest actions", () => {
    expect(access).toContain('data-testid="google-sign-in-button"');
    expect(access).toContain('data-testid="guest-play-button"');
    expect(access).toContain("loginWithGoogle");
    expect(access).toContain("playAsGuest");
    expect(access).not.toContain("unsplash.com");
    expect(access).not.toContain("animate-slide");
    expect(access).toContain('className="noir-access-card"');
  });

  test("boot has no artificial cinematic delay", () => {
    expect(boot).not.toMatch(/await new Promise\(\(r\) => setTimeout\(r, (100|200)\)\)/);
  });

  test("visual language is loaded last across app and portals", () => {
    expect(app).toContain('import "@/noir-interactions.css";');
    expect(app.indexOf('import "@/noir-interactions.css";')).toBeGreaterThan(
      app.indexOf('import "@/noir-workspaces.css";')
    );
    expect(sonner).toContain("noir-toaster");
    expect(app).toContain('className: "sub-toast noir-toast"');
    for (const token of ["--blacklist-red:", "--blacklist-ink:", "--blacklist-white:"]) {
      expect(css).toContain(token);
    }
    for (const part of ["[data-sonner-toaster]", ".sub-notification-panel", ".noir-workspace-menu a", ".noir-access-shell"]) {
      expect(css).toContain(part);
    }
  });

  test("shared actions retain semantic states with premium styling", () => {
    expect(controls).toContain("noir-control");
    for (const variant of ["sub-btn-primary", "sub-btn-success", "sub-btn-danger", "sub-btn-warning", "sub-btn-glass", "sub-btn-link"]) {
      expect(css).toContain(variant);
    }
    expect(css).toContain(":focus-visible");
    expect(css).toContain(":disabled");
    expect(css).toContain("@media (prefers-reduced-motion:reduce)");
  });
});
