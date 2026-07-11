import { useEffect, useRef, useState } from "react";
import { useAuth, DISCLAIMER_SESSION_KEY } from "../../context/AuthContextV2";
import { api } from "../../lib/api";
import { Button } from "../ui/button";
import { ShieldAlert, Scale, LogOut, RotateCcw, Check, Loader2 } from "lucide-react";

/**
 * Disclaimer de ficção — mostrado UMA vez por sessão de login, no momento em
 * que o mapa aparece. Prática padrão da indústria (à imagem dos avisos de
 * ficção de jogos AAA): lembra o jogador de que tudo no Lusorae é fictício e
 * pede um compromisso explícito de nunca replicar nada na vida real.
 *
 * Fluxo:
 *  - "Sim" → compromisso registado no servidor (data/hora/versão/IP) e o jogo
 *    continua; flag em sessionStorage impede repetição até ao próximo login.
 *  - "Não" → segundo ecrã explica que o compromisso é condição de utilização;
 *    o jogador pode reler o aviso ou terminar a sessão em segurança (a recusa
 *    também fica registada para auditoria).
 *
 * A flag de sessionStorage é limpa em login/register/logout/sessão expirada
 * (AuthContextV2), garantindo que o aviso reaparece a CADA login — mas não em
 * cada refresh da página a meio da mesma sessão.
 */
export function DisclaimerModal() {
  const { user, logout } = useAuth();
  const userId = user?.id ? String(user.id) : "";
  const [visible, setVisible] = useState(() => {
    try {
      return sessionStorage.getItem(DISCLAIMER_SESSION_KEY) !== userId;
    } catch (_err) {
      return true;
    }
  });
  const [stage, setStage] = useState("notice"); // "notice" | "declined"
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const acceptRef = useRef(null);

  // Foco inicial no botão de compromisso (acessibilidade em alertdialog).
  useEffect(() => {
    if (visible && !leaving && stage === "notice") {
      const id = setTimeout(() => acceptRef.current?.focus(), 60);
      return () => clearTimeout(id);
    }
  }, [visible, leaving, stage]);

  if (!visible) return null;

  const accept = () => {
    if (leaving) return;
    try {
      sessionStorage.setItem(DISCLAIMER_SESSION_KEY, userId);
    } catch (_err) {
      // sessionStorage indisponível → o aviso repete-se, nunca bloqueia o jogo
    }
    // Registo de auditoria no servidor — fire-and-forget, nunca bloqueia a UI.
    api.post("/legal/disclaimer-ack", { accepted: true }, { timeout: 6000 }).catch(() => {});
    setLeaving(true);
    setTimeout(() => setVisible(false), 340);
  };

  const declineFinal = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.post("/legal/disclaimer-ack", { accepted: false }, { timeout: 6000 });
    } catch (_err) {
      // Mesmo sem registo, a sessão termina — a segurança do fluxo vem primeiro.
    }
    await logout();
  };

  return (
    <div
      data-testid="disclaimer-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
      aria-describedby="disclaimer-body"
      className={`pointer-events-auto fixed inset-0 z-[130] flex items-center justify-center overflow-y-auto bg-black/85 px-4 py-6 backdrop-blur-md ${
        leaving ? "animate-out fade-out-0 duration-300 fill-mode-forwards" : "animate-in fade-in-0 duration-300"
      }`}
    >
      <div
        className={`relative my-auto w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950/95 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.85),0_0_60px_rgba(220,38,38,0.12)] ${
          leaving
            ? "animate-out fade-out-0 zoom-out-95 duration-300 fill-mode-forwards"
            : "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-300"
        }`}
      >
        {/* Cantos HUD, coerentes com a moldura do jogo */}
        <span aria-hidden="true" className="absolute -left-px -top-px h-4 w-4 rounded-tl-2xl border-l-2 border-t-2 border-red-500/70" />
        <span aria-hidden="true" className="absolute -right-px -top-px h-4 w-4 rounded-tr-2xl border-r-2 border-t-2 border-red-500/70" />
        <span aria-hidden="true" className="absolute -bottom-px -left-px h-4 w-4 rounded-bl-2xl border-b-2 border-l-2 border-red-500/70" />
        <span aria-hidden="true" className="absolute -bottom-px -right-px h-4 w-4 rounded-br-2xl border-b-2 border-r-2 border-red-500/70" />

        {stage === "notice" ? (
          <div className="p-6 md:p-7">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.35em] text-red-500/90">
              Protocolo de entrada · Aviso ao operador
            </p>
            <div className="mt-4 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 shadow-[0_0_18px_rgba(220,38,38,0.25)]">
                <ShieldAlert className="h-6 w-6 text-red-500" strokeWidth={2.2} />
              </div>
              <div>
                <h2 id="disclaimer-title" className="font-display text-xl font-bold uppercase tracking-wide text-white md:text-2xl">
                  Isto é apenas um jogo
                </h2>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">Ficção interativa · Lusorae</p>
              </div>
            </div>

            <div id="disclaimer-body" className="mt-5 space-y-3 text-sm leading-relaxed text-zinc-300">
              <p>
                O <span className="font-semibold text-white">Lusorae é uma obra de ficção</span>. Todos os crimes, esquemas,
                personagens e organizações que aqui existem são inteiramente fictícios e vivem apenas dentro deste universo virtual.
              </p>
              <p>
                <span className="font-semibold text-red-400">Nada do que acontece no jogo deve ser repetido, imitado ou servir de
                inspiração na vida real.</span>{" "}
                Atividades criminosas reais causam danos a pessoas e comunidades e têm consequências legais graves.
              </p>
              <p>
                Ao continuar, <span className="font-semibold text-white">comprometes-te</span> a tratar tudo isto como puro
                entretenimento e a nunca replicar na vida real o que vês ou fazes no jogo.
              </p>
            </div>

            <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-center font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-zinc-200">
                Assumes este compromisso?
              </p>
            </div>

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                data-testid="disclaimer-decline"
                variant="outline"
                onClick={() => setStage("declined")}
                className="sm:min-w-[140px]"
              >
                Não concordo
              </Button>
              <Button
                ref={acceptRef}
                data-testid="disclaimer-accept"
                variant="success"
                onClick={accept}
                className="sm:min-w-[240px]"
              >
                <Check className="mr-1.5 h-4 w-4" strokeWidth={2.6} />
                Sim, compreendo — é só um jogo
              </Button>
            </div>

            <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600">
              Compromisso registado com data e hora ·{" "}
              <a href="/termos" target="_blank" rel="noreferrer" className="text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline">
                Termos de Utilização
              </a>
            </p>
          </div>
        ) : (
          <div className="p-6 md:p-7" data-testid="disclaimer-declined-view">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.35em] text-amber-500/90">
              Protocolo de entrada · Acesso suspenso
            </p>
            <div className="mt-4 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 shadow-[0_0_18px_rgba(245,158,11,0.2)]">
                <Scale className="h-6 w-6 text-amber-500" strokeWidth={2.2} />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold uppercase tracking-wide text-white md:text-2xl">
                  Compromisso necessário
                </h2>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">Condição de utilização</p>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm leading-relaxed text-zinc-300">
              <p>
                O acesso à rede Lusorae depende deste compromisso — é uma{" "}
                <span className="font-semibold text-white">condição de utilização</span>. Sem ele, não podemos deixar-te continuar.
              </p>
              <p>
                Se mudaste de ideias, podes reler o aviso e aceitar. Caso contrário, a tua sessão será terminada em segurança e
                podes voltar quando estiveres pronto.
              </p>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                data-testid="disclaimer-exit"
                variant="destructive"
                onClick={declineFinal}
                disabled={busy}
                className="sm:min-w-[170px]"
              >
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <LogOut className="mr-1.5 h-4 w-4" />}
                Terminar sessão
              </Button>
              <Button
                data-testid="disclaimer-reconsider"
                variant="success"
                onClick={() => setStage("notice")}
                disabled={busy}
                className="sm:min-w-[200px]"
              >
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Reler o aviso
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
