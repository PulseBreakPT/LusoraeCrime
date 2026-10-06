import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContextV2";
import { api } from "../../lib/api";
import { Button } from "../ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "../ui/alert-dialog";
import { ShieldAlert, Scale, LogOut, RotateCcw, Check, Loader2, Hourglass } from "lucide-react";

// ---------------------------------------------------------------------------
// O compromisso continua explícito e auditável, mas não existe uma espera
// artificial antes de o jogador poder aceitar. O texto fica integralmente
// visível e "Não concordo" continua sempre disponível.
// ---------------------------------------------------------------------------
export const READ_SECONDS = 0;

/**
 * Disclaimer de ficção — mostrado UMA única vez por conta, na primeira
 * entrada no jogo (registo/primeiro login). Prática padrão da indústria (à
 * imagem dos avisos de ficção de jogos AAA): lembra o jogador de que tudo no
 * SUBMUNDO é fictício e pede um compromisso explícito de nunca replicar nada
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

  // Barra de progresso via transform: evita reflow e mantém a animação
  // confinada à camada de composição.
  useEffect(() => {
    if (!visible || !locked || stage !== "notice") return;
    const el = barRef.current;
    if (!el) return;
    const totalMs = READ_SECONDS * 1000;
    const leftMs = Math.max(0, deadlineRef.current - Date.now());
    const startPct = Math.min(100, ((totalMs - leftMs) / totalMs) * 100);
    el.style.transition = "none";
    el.style.transform = `scaleX(${startPct / 100})`;
    const id = requestAnimationFrame(() => {
      el.style.transition = `transform ${leftMs}ms linear`;
      el.style.transform = "scaleX(1)";
    });
    return () => cancelAnimationFrame(id);
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
    <AlertDialog open={visible}>
      <AlertDialogContent
        data-testid="disclaimer-overlay"
        onEscapeKeyDown={(event) => event.preventDefault()}
        className={`max-h-[calc(100dvh-1rem)] overflow-y-auto p-0 ${leaving ? "opacity-0" : "opacity-100"}`}
      >
        <AlertDialogTitle className="sr-only">Aviso de ficção do SUBMUNDO</AlertDialogTitle>
        <AlertDialogDescription className="sr-only">
          Lê o aviso e confirma que entendes que o SUBMUNDO é uma obra de ficção antes de continuar.
        </AlertDialogDescription>

        {stage === "notice" ? (
          <div className="p-6 md:p-7">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.35em] text-red-500/90">
              Aviso importante
            </p>
            <div className="mt-4 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 shadow-[0_0_18px_rgba(220,38,38,0.25)]">
                <ShieldAlert className="h-6 w-6 text-red-500" strokeWidth={2.2} />
              </div>
              <div>
                <h2 id="disclaimer-title" className="font-display text-xl font-bold uppercase tracking-wide text-white md:text-2xl">
                  Isto é apenas um jogo
                </h2>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">SUBMUNDO</p>
              </div>
            </div>

            <div id="disclaimer-body" className="mt-5 space-y-3 text-sm leading-relaxed text-zinc-300">
              <p>
                {"O "}
                <span className="font-semibold text-white">SUBMUNDO é uma obra de ficção</span>
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
                      className="h-full w-full origin-left scale-x-0 rounded-full bg-emerald-500"
                    />
                  </div>
                  <p className="mt-1.5 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                    Lê o aviso antes de continuar
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
                    {`Lê o aviso com atenção (${remaining}s)`}
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
              Aceite em{" "}
              <a href="/termos" target="_blank" rel="noreferrer" className="text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline">
                Termos de Utilização
              </a>
            </p>
          </div>
        ) : (
          <div className="p-6 md:p-7" data-testid="disclaimer-declined-view">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.35em] text-amber-500/90">
              Acesso suspenso
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
                {"Para continuar no SUBMUNDO, este compromisso é uma "}
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
      </AlertDialogContent>
    </AlertDialog>
  );
}
