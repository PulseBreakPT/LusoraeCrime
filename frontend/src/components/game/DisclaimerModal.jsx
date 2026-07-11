import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContextV2";
import { api } from "../../lib/api";
import { Button } from "../ui/button";
import { ShieldAlert, Scale, LogOut, RotateCcw, Check, Loader2, Hourglass } from "lucide-react";

// ---------------------------------------------------------------------------
// Tempo de leitura obrigatório — o botão "aceitar" só desbloqueia depois de o
// jogador ter tido tempo real para ler o aviso (prática de consentimento
// informado). O tempo é DERIVADO do próprio texto: contagem de palavras a
// ~200 ppm (leitura atenta em pt-PT), limitado a [8s, 20s] para nunca ser
// absurdo se o texto mudar. O botão "Não concordo" fica sempre clicável.
// ---------------------------------------------------------------------------
const NOTICE_PLAIN_TEXT = [
  "O Lusorae é uma obra de ficção. Todos os crimes, esquemas, personagens e organizações que aqui existem são inteiramente fictícios e vivem apenas dentro deste universo virtual.",
  "Nada do que acontece no jogo deve ser repetido, imitado ou servir de inspiração na vida real. Atividades criminosas reais causam danos a pessoas e comunidades e têm consequências legais graves.",
  "Ao continuar, comprometes-te a tratar tudo isto como puro entretenimento e a nunca replicar na vida real o que vês ou fazes no jogo.",
  "Assumes este compromisso?",
].join(" ");
const WORD_COUNT = NOTICE_PLAIN_TEXT.trim().split(/\s+/).length;
const WORDS_PER_MINUTE = 200;
export const READ_SECONDS = Math.min(20, Math.max(8, Math.ceil((WORD_COUNT / WORDS_PER_MINUTE) * 60)));

/**
 * Disclaimer de ficção — mostrado UMA única vez por conta, na primeira
 * entrada no jogo (registo/primeiro login). Prática padrão da indústria (à
 * imagem dos avisos de ficção de jogos AAA): lembra o jogador de que tudo no
 * Lusorae é fictício e pede um compromisso explícito de nunca replicar nada
 * na vida real.
 *
 * Fluxo:
 *  - "Sim" → compromisso registado no servidor com data/hora/versão/IP
 *    (POST /legal/disclaimer-ack) e o jogo continua; a fonte de verdade é
 *    user.disclaimer_accepted (derivado desse registo de auditoria), pelo que
 *    depois de aceite nunca mais reaparece — nem noutro login, nem noutro
 *    dispositivo.
 *  - "Não" → segundo ecrã explica que o compromisso é condição de utilização;
 *    o jogador pode reler o aviso ou terminar a sessão em segurança (a recusa
 *    também fica registada para auditoria).
 */
export function DisclaimerModal() {
  const { user, logout, markDisclaimerAccepted } = useAuth();
  const [stage, setStage] = useState("notice"); // "notice" | "declined"
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const acceptRef = useRef(null);

  // Visibilidade derivada do servidor: só aparece enquanto a conta ainda não
  // assumiu o compromisso. `markDisclaimerAccepted` (chamado após a animação
  // de saída) vira user.disclaimer_accepted a true e desmonta o modal.
  const visible = !!user && !user.disclaimer_accepted;

  // Contagem decrescente de leitura — o prazo é fixado quando o modal monta e
  // continua a correr mesmo que o jogador passe pelo ecrã de recusa e volte
  // (o tempo de leitura já decorrido conta; não recomeça do zero).
  const deadlineRef = useRef(Date.now() + READ_SECONDS * 1000);
  const [remaining, setRemaining] = useState(READ_SECONDS);
  const locked = remaining > 0;
  const barRef = useRef(null);

  useEffect(() => {
    if (!visible || !locked) return;
    const id = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(id);
  }, [visible, locked]);

  // Barra de progresso fluida — em vez de saltar a cada segundo (re-render),
  // é o próprio CSS que interpola a largura linearmente até ao prazo: parte da
  // fração já decorrida (importante ao voltar do ecrã de recusa a meio) e
  // anima até 100% no tempo restante exato, a 60fps e sem re-renders.
  useEffect(() => {
    if (!visible || !locked || stage !== "notice") return;
    const el = barRef.current;
    if (!el) return;
    const totalMs = READ_SECONDS * 1000;
    const leftMs = Math.max(0, deadlineRef.current - Date.now());
    const startPct = Math.min(100, ((totalMs - leftMs) / totalMs) * 100);
    el.style.transition = "none";
    el.style.width = `${startPct}%`;
    void el.offsetWidth; // reflow: fixa o ponto de partida antes de animar
    el.style.transition = `width ${leftMs}ms linear`;
    el.style.width = "100%";
  }, [visible, locked, stage]);

  // Foco no botão de compromisso assim que desbloqueia (acessibilidade em
  // alertdialog — enquanto está desativado não pode receber foco).
  useEffect(() => {
    if (visible && !leaving && stage === "notice" && !locked) {
      const id = setTimeout(() => acceptRef.current?.focus(), 60);
      return () => clearTimeout(id);
    }
  }, [visible, leaving, stage, locked]);

  if (!visible) return null;

  const accept = () => {
    if (leaving || locked) return;
    // Registo de auditoria no servidor — fonte de verdade permanente (por
    // conta). Fire-and-forget: nunca bloqueia a UI; se falhar, o campo
    // user.disclaimer_accepted continua false e o aviso repete no próximo
    // login, nunca deixando o compromisso por registar.
    api.post("/legal/disclaimer-ack", { accepted: true }, { timeout: 6000 }).catch(() => {});
    setLeaving(true);
    // Só depois da animação de saída é que o estado do utilizador é
    // atualizado (disclaimer_accepted: true) — nesse momento `visible` passa
    // a false e o modal desmonta-se.
    setTimeout(() => markDisclaimerAccepted(), 340);
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
                {"O "}
                <span className="font-semibold text-white">Lusorae é uma obra de ficção</span>
                {". Todos os crimes, esquemas, personagens e organizações que aqui existem são inteiramente fictícios e vivem apenas dentro deste universo virtual."}
              </p>
              <p>
                <span className="font-semibold text-red-400">
                  {"Nada do que acontece no jogo deve ser repetido, imitado ou servir de inspiração na vida real."}
                </span>
                {" Atividades criminosas reais causam danos a pessoas e comunidades e têm consequências legais graves."}
              </p>
              <p>
                {"Ao continuar, "}
                <span className="font-semibold text-white">comprometes-te</span>
                {" a tratar tudo isto como puro entretenimento e a nunca replicar na vida real o que vês ou fazes no jogo."}
              </p>
            </div>

            <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-center font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-zinc-200">
                Assumes este compromisso?
              </p>
              {locked && (
                <div className="mt-2.5" data-testid="disclaimer-read-progress">
                  <div className="h-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      ref={barRef}
                      className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                      style={{ width: "0%" }}
                    />
                  </div>
                  <p className="mt-1.5 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                    Tempo de leitura em curso — lê com calma
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                data-testid="disclaimer-decline"
                variant="destructive"
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
                disabled={locked}
                aria-disabled={locked}
                className="sm:min-w-[240px]"
              >
                {locked ? (
                  <>
                    <Hourglass className="mr-1.5 h-4 w-4 animate-pulse" />
                    {`Lê o aviso com atenção · ${remaining}s`}
                  </>
                ) : (
                  <>
                    <Check className="mr-1.5 h-4 w-4" strokeWidth={2.6} />
                    Sim, compreendo — é só um jogo
                  </>
                )}
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
                {"O acesso à rede Lusorae depende deste compromisso — é uma "}
                <span className="font-semibold text-white">condição de utilização</span>
                {". Sem ele, não podemos deixar-te continuar."}
              </p>
              <p>
                {"Se mudaste de ideias, podes reler o aviso e aceitar. Caso contrário, a tua sessão será terminada em segurança e podes voltar quando estiveres pronto."}
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
