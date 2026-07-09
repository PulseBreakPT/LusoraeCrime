import { useEffect, useRef } from "react";

// Contador de FPS de custo zero: mede frames reais com requestAnimationFrame
// e escreve diretamente no DOM (textContent) — nunca passa pelo React, por
// isso o próprio contador não rouba um único frame ao jogo.
export const FpsMeter = () => {
  const valRef = useRef(null);

  useEffect(() => {
    let raf;
    let frames = 0;
    let last = performance.now();

    const loop = (now) => {
      frames += 1;
      const dt = now - last;
      if (dt >= 500) {
        const fps = Math.round((frames * 1000) / dt);
        frames = 0;
        last = now;
        const el = valRef.current;
        if (el) {
          el.textContent = String(fps);
          el.style.color = fps >= 55 ? "#34D399" : fps >= 30 ? "#FBBF24" : "#EF4444";
        }
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="lus-fps" data-testid="fps-meter" aria-hidden="true">
      <span ref={valRef} className="lus-fps-value">—</span>
      <span className="lus-fps-label">FPS</span>
    </div>
  );
};
