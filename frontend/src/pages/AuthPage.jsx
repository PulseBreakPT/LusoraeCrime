import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContextV2";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { evaluatePassword } from "../lib/passwordStrength";
import {
  Loader2, AlertCircle, ShieldCheck, Eye, EyeOff, Check, X,
  MapPinned, Users, Landmark, WifiOff, Clock, ArrowUpCircle, KeyRound,
  Mail, Lock, Building2, LogIn, Crown, ArrowRight, Radio,
} from "lucide-react";

const BG = "https://images.unsplash.com/photo-1731234361187-4702894e725a?crop=entropy&cs=srgb&fm=jpg&q=85&w=1920";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ORG_FORBIDDEN_RE = /[<>{}[\]\\/;`]/;

// Mantém login/registo no código e permite ocultá-los por ambiente.
const AUTH_UI_ENABLED = process.env.REACT_APP_AUTH_UI_ENABLED !== "false";

// Código de sessão gerado uma vez por carregamento da página (HUD inferior)
const SESSION_CODE = (() => {
  const chars = "0123456789ABCDEF";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
})();

const INTEL_LINES = [
  "23:14 · Carga não registada avistada no Cais do Sodré",
  "23:31 · A PJ reforçou patrulhas na Baixa",
  "23:47 · Informador reporta cofre mal guardado em Alfama",
  "00:02 · Leilão clandestino marcado no Bairro Alto",
];

// ---------------------------------------------------------------------------
// Validação local (espelho da validação do servidor)
// ---------------------------------------------------------------------------
const validateOrgName = (v) => {
  const c = (v || "").trim().replace(/\s+/g, " ");
  if (!c) return "Indica o nome da tua organização.";
  if (c.length < 3) return "O nome deve ter pelo menos 3 caracteres.";
  if (c.length > 40) return "O nome não pode exceder 40 caracteres.";
  if (ORG_FORBIDDEN_RE.test(c)) return "O nome contém caracteres não permitidos.";
  return "";
};

const validateEmail = (v) => {
  const c = (v || "").trim();
  if (!c) return "Indica o teu email.";
  if (!EMAIL_RE.test(c)) return "Formato de email inválido.";
  return "";
};

const validatePassword = (v, mode) => {
  if (!v) return "Indica a tua palavra-passe.";
  if (mode === "register" && !evaluatePassword(v).meetsPolicy) {
    return "A palavra-passe ainda não cumpre todos os requisitos.";
  }
  return "";
};

const validateConfirm = (v, password) => {
  if (!v) return "Confirma a tua palavra-passe.";
  if (v !== password) return "As palavras-passe não coincidem.";
  return "";
};

const formatCountdown = (secs) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

// ---------------------------------------------------------------------------
// Micro-componentes
// ---------------------------------------------------------------------------
const FieldError = ({ id, testId, children }) => (
  <p id={id} data-testid={testId} role="alert" className="flex items-start gap-1.5 text-xs text-red-400">
    <AlertCircle size={13} className="mt-px shrink-0" aria-hidden="true" />
    <span>{children}</span>
  </p>
);

const AvailabilityHint = ({ state, entity }) => {
  if (state === "checking") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-zinc-500" role="status">
        <Loader2 size={12} className="animate-spin" aria-hidden="true" /> A verificar disponibilidade…
      </span>
    );
  }
  if (state === "available") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-400" role="status">
        <Check size={13} aria-hidden="true" /> {entity} disponível
      </span>
    );
  }
  return null;
};

// Relógio da rede isolado — o intervalo de 1s só re-renderiza este componente,
// nunca a página inteira (performance).
function NetworkClock() {
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString("pt-PT", { hour12: false }));
  useEffect(() => {
    const iv = setInterval(() => setClock(new Date().toLocaleTimeString("pt-PT", { hour12: false })), 1000);
    return () => clearInterval(iv);
  }, []);
  return <span className="tabular-nums">{clock}</span>;
}

const FieldLabel = ({ htmlFor, children }) => (
  <Label htmlFor={htmlFor} className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
    <span className="h-[3px] w-[3px] bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.9)]" aria-hidden="true" />
    {children}
  </Label>
);

const Feature = ({ icon: Icon, index, title, text }) => (
  <div className="lus-auth-feature group">
    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent text-red-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors group-hover:border-red-500/40 group-hover:text-red-400">
      <Icon size={17} aria-hidden="true" />
    </div>
    <div className="min-w-0">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[9px] font-bold tracking-[0.25em] text-red-500/70">{String(index).padStart(2, "0")}</span>
        <span className="font-display text-sm font-bold uppercase tracking-wide text-zinc-100">{title}</span>
      </div>
      <div className="mt-1 text-xs leading-relaxed text-zinc-500">{text}</div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------
export default function AuthPage() {
  const { user, login, register, loginWithGoogle, googleSignInEnabled, checkAvailability } = useAuth();
  const [mode, setMode] = useState("login");
  const [values, setValues] = useState({ orgName: "", email: "", password: "", confirm: "" });
  const [touched, setTouched] = useState({});
  const [submittedOnce, setSubmittedOnce] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [availability, setAvailability] = useState({ email: null, orgName: null });
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState("");

  const submittingRef = useRef(false);
  const orgRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);
  const emailReqId = useRef(0);
  const orgReqId = useRef(0);

  const strength = useMemo(() => evaluatePassword(values.password), [values.password]);

  // Aviso de sessão expirada (definido pelo interceptor da API)
  useEffect(() => {
    try {
      if (sessionStorage.getItem("lus_session_expired") === "1") {
        setSessionExpired(true);
        sessionStorage.removeItem("lus_session_expired");
      }
    } catch (_e) { /* sessionStorage indisponível */ }
    const onExpired = () => setSessionExpired(true);
    window.addEventListener("lus:session-expired", onExpired);
    return () => window.removeEventListener("lus:session-expired", onExpired);
  }, []);

  // Autofocus inteligente por modo
  useEffect(() => {
    const t = setTimeout(() => {
      if (mode === "register") orgRef.current?.focus();
      else emailRef.current?.focus();
    }, 60);
    return () => clearTimeout(t);
  }, [mode]);

  // Contagem decrescente do bloqueio por tentativas (429)
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const iv = setInterval(() => {
      setLockoutSeconds((s) => {
        if (s <= 1) {
          setServerError(null);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [lockoutSeconds > 0]);

  // Disponibilidade do email em tempo real (registo)
  useEffect(() => {
    if (mode !== "register") return;
    const email = values.email.trim().toLowerCase();
    if (!email || validateEmail(email)) {
      setAvailability((a) => ({ ...a, email: null }));
      return;
    }
    setAvailability((a) => ({ ...a, email: "checking" }));
    const id = ++emailReqId.current;
    const t = setTimeout(async () => {
      const res = await checkAvailability({ email });
      if (emailReqId.current !== id) return;
      if (!res.ok || !res.data?.email) {
        setAvailability((a) => ({ ...a, email: null }));
        return;
      }
      setAvailability((a) => ({ ...a, email: res.data.email.available ? "available" : "taken" }));
    }, 450);
    return () => clearTimeout(t);
  }, [values.email, mode, checkAvailability]);

  // Disponibilidade do nome da organização em tempo real (registo)
  useEffect(() => {
    if (mode !== "register") return;
    const name = values.orgName.trim().replace(/\s+/g, " ");
    if (!name || validateOrgName(name)) {
      setAvailability((a) => ({ ...a, orgName: null }));
      return;
    }
    setAvailability((a) => ({ ...a, orgName: "checking" }));
    const id = ++orgReqId.current;
    const t = setTimeout(async () => {
      const res = await checkAvailability({ org_name: name });
      if (orgReqId.current !== id) return;
      if (!res.ok || !res.data?.org_name) {
        setAvailability((a) => ({ ...a, orgName: null }));
        return;
      }
      setAvailability((a) => ({ ...a, orgName: res.data.org_name.available ? "available" : "taken" }));
    }, 450);
    return () => clearTimeout(t);
  }, [values.orgName, mode, checkAvailability]);

  // Erros de validação em tempo real
  const errors = useMemo(() => {
    const e = {};
    if (mode === "register") {
      e.orgName = validateOrgName(values.orgName) ||
        (availability.orgName === "taken" ? "Este nome de organização já está a ser utilizado." : "");
      e.confirm = validateConfirm(values.confirm, values.password);
    }
    e.email = validateEmail(values.email) ||
      (mode === "register" && availability.email === "taken" ? "Este email já está registado." : "");
    e.password = validatePassword(values.password, mode);
    return e;
  }, [values, mode, availability]);

  const showError = (field) => (touched[field] || submittedOnce) && errors[field];

  const setValue = (field) => (e) => {
    const v = e.target.value;
    setValues((prev) => ({ ...prev, [field]: v }));
    if (serverError && !serverError.isNetwork && serverError.status !== 429) setServerError(null);
  };

  const markTouched = (field) => () => setTouched((t) => ({ ...t, [field]: true }));

  const handleCapsLock = (e) => {
    if (typeof e.getModifierState === "function") setCapsLock(e.getModifierState("CapsLock"));
  };

  const switchMode = (m) => {
    if (m === mode) return;
    setMode(m);
    setTouched({});
    setSubmittedOnce(false);
    setServerError(null);
    setTermsError(false);
    setCapsLock(false);
    setShowPassword(false);
    setShowConfirm(false);
    setAvailability({ email: null, orgName: null });
    setValues((v) => ({ ...v, password: "", confirm: "" }));
  };

  const doSubmit = useCallback(async () => {
    // Guarda contra cliques múltiplos / submissões duplicadas
    if (submittingRef.current || lockoutSeconds > 0) return;
    setSubmittedOnce(true);
    setTermsError(false);

    const fieldOrder = mode === "register"
      ? [["orgName", orgRef], ["email", emailRef], ["password", passwordRef], ["confirm", confirmRef]]
      : [["email", emailRef], ["password", passwordRef]];
    const currentErrors = {};
    if (mode === "register") {
      currentErrors.orgName = validateOrgName(values.orgName) ||
        (availability.orgName === "taken" ? "nome ocupado" : "");
      currentErrors.confirm = validateConfirm(values.confirm, values.password);
    }
    currentErrors.email = validateEmail(values.email) ||
      (mode === "register" && availability.email === "taken" ? "email ocupado" : "");
    currentErrors.password = validatePassword(values.password, mode);

    const firstInvalid = fieldOrder.find(([f]) => currentErrors[f]);
    if (firstInvalid) {
      firstInvalid[1].current?.focus();
      return;
    }
    if (mode === "register" && !acceptTerms) {
      setTermsError(true);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setServerError(null);
    try {
      const res = mode === "login"
        ? await login(values.email.trim(), values.password)
        : await register(values.orgName.trim().replace(/\s+/g, " "), values.email.trim(), values.password, acceptTerms);
      if (!res.ok) {
        setServerError(res);
        if (res.status === 429 && res.retryAfter) setLockoutSeconds(res.retryAfter);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [mode, values, acceptTerms, availability, lockoutSeconds, login, register]);

  const submit = (e) => {
    e.preventDefault();
    doSubmit();
  };

  const handleGoogleLogin = async () => {
    if (googleBusy || !googleSignInEnabled) return;
    setGoogleError("");
    setGoogleBusy(true);
    const res = await loginWithGoogle();
    setGoogleBusy(false);
    if (!res.ok) setGoogleError(res.error || "Não foi possível iniciar sessão com a Google.");
  };

  if (user) return <Navigate to="/" replace />;

  // Em builds onde email/password fica oculto, o acesso Google continua
  // disponível. Assim a versão pública nunca fica presa num ecrã reservado.
  if (!AUTH_UI_ENABLED) {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#050506] px-4">
        <img src={BG} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050506] via-[#050506]/90 to-[#050506]/65" />
        <div className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-black/70 p-7 text-center shadow-2xl backdrop-blur-md">
          <ShieldCheck className="mx-auto h-8 w-8 text-red-500" aria-hidden="true" />
          <h1 className="mt-4 font-display text-4xl font-bold uppercase tracking-tight text-white">Lusorae</h1>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.3em] text-red-400">Entrar na rede</p>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-zinc-400">
            Entra com a tua Conta Google para criar ou retomar o teu império.
          </p>
          <Button
            type="button"
            data-testid="google-sign-in-button"
            onClick={handleGoogleLogin}
            disabled={googleBusy || !googleSignInEnabled}
            className="mt-6 h-12 w-full bg-white font-semibold text-zinc-950 hover:bg-zinc-100"
          >
            {googleBusy ? <Loader2 size={18} className="mr-2 animate-spin" /> : <span className="mr-2 text-lg font-bold">G</span>}
            Continuar com Google
          </Button>
          {!googleSignInEnabled && (
            <p className="mt-3 text-xs text-amber-400">Google Sign-In ainda não está configurado nesta build.</p>
          )}
          {googleError && <p className="mt-3 text-xs text-red-400" role="alert">{googleError}</p>}
          <p className="mt-5 text-[11px] leading-relaxed text-zinc-500">
            Ao continuar, aceitas os <Link to="/termos" className="text-zinc-300 underline">Termos de Serviço</Link> e a{" "}
            <Link to="/privacidade" className="text-zinc-300 underline">Política de Privacidade</Link>.
          </p>
        </div>
      </div>
    );
  }

  const isLocked = lockoutSeconds > 0;
  const submitDisabled = submitting || isLocked;

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#050506]">
      {/* ------------------------------------------- Camadas cinematográficas
          (apenas camadas estáticas — efeitos animados em ecrã inteiro foram
          removidos por custo de performance sob o backdrop-filter) */}
      <img src={BG} alt="" aria-hidden="true" className="lus-kenburns absolute inset-0 h-full w-full object-cover opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#050506] via-[#050506]/80 to-[#050506]/45" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(65%_50%_at_22%_32%,rgba(220,38,38,0.10),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_80%_62%,rgba(212,168,83,0.05),transparent_70%)]" />
      <div className="lus-boot-crt" aria-hidden="true" />
      <div className="lus-boot-vignette" aria-hidden="true" />

      {/* ------------------------------------------------------- HUD do ecrã */}
      <div className="lus-boot-hud lus-boot-hud-top z-20" aria-hidden="true">
        <span>Lusorae OS // Noir-2.6</span>
        <span className="lus-boot-ruler" />
        <span className="hidden sm:inline">Lisboa · 38.7223° N · 9.1393° O</span>
        <span className="sm:hidden">Lisboa</span>
      </div>
      <div className="lus-boot-hud lus-boot-hud-bottom z-20" aria-hidden="true">
        <span className="lus-boot-rec">
          <span className="lus-boot-rec-dot" />
          <span className="hidden sm:inline">Canal cifrado · AES-256</span>
          <span className="sm:hidden">Cifrado</span>
        </span>
        <span className="lus-boot-ruler" />
        <span className="hidden sm:inline">Sessão {SESSION_CODE}</span>
        <NetworkClock />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-16 sm:px-8 lg:px-10">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[1fr_460px] lg:gap-14">

          {/* ------------------------------------------------ Painel de marca */}
          <div className="animate-slide-up">
            <div className="mb-6 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.4em] text-red-400/90">
              <span className="h-px w-10 bg-gradient-to-r from-transparent to-red-500/80" aria-hidden="true" />
              <ShieldCheck size={13} aria-hidden="true" />
              <span>Lisboa · Rede Criminosa</span>
              <span className="hidden h-px flex-1 bg-gradient-to-r from-red-500/40 to-transparent sm:block" aria-hidden="true" />
            </div>

            <h1 className="lus-auth-logo font-display text-6xl font-bold uppercase leading-none tracking-tight sm:text-8xl">Lusorae</h1>
            <div className="lus-auth-rule mt-4 w-36" aria-hidden="true" />

            <p className="mt-5 max-w-md text-sm leading-relaxed text-zinc-400">
              Não controlas uma personagem. Controlas um império. Gere equipas, veículos e operações
              num mapa vivo de Lisboa — a cidade não dorme, e a tua organização também não.
            </p>

            {/* Interceção da rede (ticker) */}
            <div className="mt-6 hidden max-w-md rounded-lg border border-white/[0.08] bg-black/40 px-4 py-3 backdrop-blur-sm lg:block">
              <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.3em]">
                <span className="flex items-center gap-2 text-red-400/90">
                  <Radio size={11} className="animate-pulse" aria-hidden="true" /> Interceção da rede
                </span>
                <span className="text-zinc-600">Freq 462.30</span>
              </div>
              <div className="lus-intel-lines mt-2 font-mono text-[11px] text-zinc-400">
                {INTEL_LINES.map((l) => <span key={l}>{l}</span>)}
              </div>
            </div>

            <div className="mt-6 hidden max-w-md flex-col gap-3 lg:flex">
              <Feature icon={MapPinned} index={1} title="Mapa vivo de Lisboa" text="16 zonas, oportunidades em tempo real e unidades a mover-se pela cidade." />
              <Feature icon={Users} index={2} title="A tua gente é o coração" text="14 especializações, talentos, lealdade e moral — cada contratação conta." />
              <Feature icon={Landmark} index={3} title="Economia dupla" text="Dinheiro limpo, dinheiro sujo e a arte de o lavar sem atrair o calor." />
            </div>

            {/* Estatísticas */}
            <div className="mt-7 hidden items-stretch lg:flex">
              {[["16", "Zonas de Lisboa"], ["14", "Especializações"], ["24/7", "Economia viva"]].map(([n, l], i) => (
                <div key={l} className={`flex items-center gap-3 ${i > 0 ? "ml-6 border-l border-white/10 pl-6" : ""}`}>
                  <span className="font-display text-3xl font-bold leading-none text-white [text-shadow:0_0_18px_rgba(220,38,38,0.35)]">{n}</span>
                  <span className="max-w-[92px] font-mono text-[9px] uppercase leading-snug tracking-[0.2em] text-zinc-500">{l}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 hidden items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-zinc-600 lg:flex">
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                Rede operacional
              </span>
              <span className="text-zinc-700">·</span>
              <span>Temporada 0</span>
              <span className="text-zinc-700">·</span>
              <Link to="/changelog" className="transition-colors hover:text-zinc-300">v0.6.0</Link>
            </div>
          </div>

          {/* ------------------------------------------------ Moldura de acesso */}
          <div className="w-full animate-slide-up" style={{ animationDelay: "80ms" }}>
            <div className="lus-frame w-full">
              <span className="lus-frame-topline" aria-hidden="true" />
              <span className="lus-corner-tr" aria-hidden="true" />
              <span className="lus-corner-bl" aria-hidden="true" />
              <span className="lus-frame-ticks lus-frame-ticks-l" aria-hidden="true" />
              <span className="lus-frame-ticks lus-frame-ticks-r" aria-hidden="true" />

              <div className="lus-frame-header">
                <span>Acesso à rede</span>
                <span className={isLocked ? "lus-frame-status lus-frame-status-error" : "lus-frame-status"}>
                  <span className="lus-frame-status-dot" aria-hidden="true" />
                  {isLocked ? "Bloqueado" : submitting ? "A cifrar" : "Canal aberto"}
                </span>
              </div>

              <div className="px-5 pt-5 sm:px-6">
                <Button
                  type="button"
                  data-testid="google-sign-in-button-full"
                  onClick={handleGoogleLogin}
                  disabled={googleBusy || !googleSignInEnabled}
                  className="h-11 w-full bg-white font-semibold text-zinc-950 hover:bg-zinc-100"
                >
                  {googleBusy ? <Loader2 size={17} className="mr-2 animate-spin" /> : <span className="mr-2 text-base font-bold">G</span>}
                  Continuar com Google
                </Button>
                {!googleSignInEnabled && (
                  <p className="mt-2 text-center text-[10px] text-amber-400">Google Sign-In ainda não está configurado nesta build.</p>
                )}
                {googleError && <p className="mt-2 text-center text-xs text-red-400" role="alert">{googleError}</p>}
                <div className="my-4 flex items-center gap-3" aria-hidden="true">
                  <span className="h-px flex-1 bg-white/10" />
                  <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-zinc-600">ou</span>
                  <span className="h-px flex-1 bg-white/10" />
                </div>
              </div>

              {/* ------------------------------------------------------- Tabs */}
              <div className="lus-auth-tabs" data-mode={mode} role="tablist" aria-label="Modo de acesso">
                <span className="lus-auth-glider" aria-hidden="true" />
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "login"}
                  data-active={mode === "login"}
                  data-testid="auth-tab-login"
                  className="lus-auth-tab"
                  onClick={() => switchMode("login")}
                >
                  <LogIn size={13} aria-hidden="true" /> Entrar
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "register"}
                  data-active={mode === "register"}
                  data-testid="auth-tab-register"
                  className="lus-auth-tab"
                  onClick={() => switchMode("register")}
                >
                  <Crown size={13} aria-hidden="true" /> Criar Império
                </button>
              </div>
              <p data-testid="google-terms-copy" className="mt-3 px-5 text-center text-[10px] leading-relaxed text-zinc-600 sm:px-6">
                Ao continuar com Google, aceitas os <Link to="/termos" className="text-zinc-400 underline">Termos de Serviço</Link> e a{" "}
                <Link to="/privacidade" className="text-zinc-400 underline">Política de Privacidade</Link>.
              </p>

              {/* ------------------------------------------- Cabeçalho do modo */}
              <div key={`head-${mode}`} className="lus-auth-swap mt-5">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-red-400/90">
                  {mode === "login" ? "// Retomar o comando" : "// Fundar organização"}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
                  {mode === "login"
                    ? "A cidade não parou enquanto estiveste fora. Retoma o comando."
                    : "Escolhe um nome. Lisboa trata de o pôr à prova."}
                </p>
              </div>

              {sessionExpired && (
                <div
                  data-testid="auth-expired-banner"
                  role="status"
                  className="lus-auth-alert lus-auth-alert-amber mt-4 text-amber-200"
                >
                  <div className="flex items-center gap-2">
                    <KeyRound size={13} className="shrink-0 text-amber-400" aria-hidden="true" />
                    <span className="lus-auth-alert-kicker text-amber-400">Transmissão · Sessão</span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed">A tua sessão expirou por segurança. Inicia sessão novamente para retomar o comando.</p>
                </div>
              )}

              <form onSubmit={submit} noValidate className="mt-4">
                <div key={mode} className="lus-auth-swap space-y-4">
                  {/* ------------------------------------------- Organização */}
                  {mode === "register" && (
                    <div className="space-y-1.5">
                      <FieldLabel htmlFor="org-name">Organização</FieldLabel>
                      <div className="lus-auth-field">
                        <Building2 size={15} className="lus-auth-field-icon" aria-hidden="true" />
                        <Input
                          id="org-name"
                          ref={orgRef}
                          data-testid="register-org-name-input"
                          placeholder="Nome da organização"
                          value={values.orgName}
                          onChange={setValue("orgName")}
                          onBlur={markTouched("orgName")}
                          maxLength={40}
                          autoComplete="organization"
                          aria-invalid={!!showError("orgName")}
                          aria-describedby={showError("orgName") ? "org-name-error" : undefined}
                          className={`h-11 rounded-lg border-white/10 bg-black/45 pl-10 pr-9 text-white placeholder:text-zinc-600 ${showError("orgName") ? "border-red-500/60 focus-visible:ring-red-500/40" : availability.orgName === "available" ? "border-emerald-500/40" : ""}`}
                        />
                        {availability.orgName === "available" && !errors.orgName && (
                          <Check size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400" aria-hidden="true" />
                        )}
                        {availability.orgName === "taken" && (
                          <X size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400" aria-hidden="true" />
                        )}
                      </div>
                      {showError("orgName")
                        ? <FieldError id="org-name-error" testId="org-name-error">{errors.orgName}</FieldError>
                        : <AvailabilityHint state={availability.orgName} entity="Nome" />}
                    </div>
                  )}

                  {/* -------------------------------------------------- Email */}
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="auth-email">Email</FieldLabel>
                    <div className="lus-auth-field">
                      <Mail size={15} className="lus-auth-field-icon" aria-hidden="true" />
                      <Input
                        id="auth-email"
                        ref={emailRef}
                        data-testid="auth-email-input"
                        type="email"
                        inputMode="email"
                        placeholder="nome@exemplo.com"
                        value={values.email}
                        onChange={setValue("email")}
                        onBlur={markTouched("email")}
                        autoComplete="email"
                        aria-invalid={!!showError("email")}
                        aria-describedby={showError("email") ? "email-error" : undefined}
                        className={`h-11 rounded-lg border-white/10 bg-black/45 pl-10 pr-9 text-white placeholder:text-zinc-600 ${showError("email") ? "border-red-500/60 focus-visible:ring-red-500/40" : mode === "register" && availability.email === "available" ? "border-emerald-500/40" : ""}`}
                      />
                      {mode === "register" && availability.email === "available" && !errors.email && (
                        <Check size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400" aria-hidden="true" />
                      )}
                      {mode === "register" && availability.email === "taken" && (
                        <X size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400" aria-hidden="true" />
                      )}
                    </div>
                    {showError("email")
                      ? <FieldError id="email-error" testId="email-error">{errors.email}</FieldError>
                      : mode === "register" && <AvailabilityHint state={availability.email} entity="Email" />}
                  </div>

                  {/* ------------------------------------------ Palavra-passe */}
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="auth-password">Palavra-passe</FieldLabel>
                    <div className="lus-auth-field">
                      <Lock size={15} className="lus-auth-field-icon" aria-hidden="true" />
                      <Input
                        id="auth-password"
                        ref={passwordRef}
                        data-testid="auth-password-input"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={values.password}
                        onChange={setValue("password")}
                        onBlur={() => { markTouched("password")(); setCapsLock(false); }}
                        onKeyDown={handleCapsLock}
                        onKeyUp={handleCapsLock}
                        autoComplete={mode === "login" ? "current-password" : "new-password"}
                        aria-invalid={!!showError("password")}
                        aria-describedby={showError("password") ? "password-error" : undefined}
                        className={`h-11 rounded-lg border-white/10 bg-black/45 pl-10 pr-10 text-white placeholder:text-zinc-600 ${showError("password") ? "border-red-500/60 focus-visible:ring-red-500/40" : ""}`}
                      />
                      <button
                        type="button"
                        data-testid="auth-password-toggle"
                        onClick={() => setShowPassword((s) => !s)}
                        tabIndex={-1}
                        aria-label={showPassword ? "Esconder palavra-passe" : "Mostrar palavra-passe"}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-zinc-500 transition-colors hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {capsLock && (
                      <p data-testid="auth-capslock-indicator" role="status" className="flex items-center gap-1.5 text-xs text-amber-400">
                        <ArrowUpCircle size={13} aria-hidden="true" /> Caps Lock está ativo
                      </p>
                    )}
                    {showError("password") && <FieldError id="password-error" testId="password-error">{errors.password}</FieldError>}

                    {/* Força + requisitos (registo) */}
                    {mode === "register" && (
                      <div data-testid="password-strength-meter" className="space-y-2 pt-1.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex flex-1 gap-1.5" aria-hidden="true">
                            {[1, 2, 3, 4].map((i) => (
                              <div
                                key={i}
                                className={`lus-seg ${values.password && i <= strength.score ? `lus-seg-on ${strength.barColor}` : "bg-white/10"}`}
                              />
                            ))}
                          </div>
                          {values.password && (
                            <span className={`font-mono text-[10px] font-bold uppercase tracking-[0.18em] ${strength.textColor}`} role="status">
                              {strength.label}
                            </span>
                          )}
                        </div>
                        <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2.5">
                          {strength.requirements.map((r) => (
                            <li key={r.key} className={`flex items-center gap-1.5 font-mono text-[10px] transition-colors ${r.met ? "text-emerald-400" : "text-zinc-500"}`}>
                              {r.met ? <Check size={12} aria-hidden="true" /> : <X size={12} className="text-zinc-600" aria-hidden="true" />}
                              {r.label}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* -------------------------------- Confirmar palavra-passe */}
                  {mode === "register" && (
                    <div className="space-y-1.5">
                      <FieldLabel htmlFor="auth-confirm">Confirmar palavra-passe</FieldLabel>
                      <div className="lus-auth-field">
                        <Lock size={15} className="lus-auth-field-icon" aria-hidden="true" />
                        <Input
                          id="auth-confirm"
                          ref={confirmRef}
                          data-testid="register-confirm-password-input"
                          type={showConfirm ? "text" : "password"}
                          placeholder="••••••••"
                          value={values.confirm}
                          onChange={setValue("confirm")}
                          onBlur={markTouched("confirm")}
                          onKeyDown={handleCapsLock}
                          onKeyUp={handleCapsLock}
                          autoComplete="new-password"
                          aria-invalid={!!showError("confirm")}
                          aria-describedby={showError("confirm") ? "confirm-error" : undefined}
                          className={`h-11 rounded-lg border-white/10 bg-black/45 pl-10 pr-10 text-white placeholder:text-zinc-600 ${showError("confirm") ? "border-red-500/60 focus-visible:ring-red-500/40" : values.confirm && values.confirm === values.password ? "border-emerald-500/40" : ""}`}
                        />
                        <button
                          type="button"
                          data-testid="auth-confirm-toggle"
                          onClick={() => setShowConfirm((s) => !s)}
                          tabIndex={-1}
                          aria-label={showConfirm ? "Esconder confirmação" : "Mostrar confirmação"}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-zinc-500 transition-colors hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
                        >
                          {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      {showError("confirm") && <FieldError id="confirm-error" testId="confirm-error">{errors.confirm}</FieldError>}
                    </div>
                  )}

                  {/* ------------------------------------- Termos e Política */}
                  {mode === "register" && (
                    <div className="space-y-1.5 pt-0.5">
                      <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${termsError ? "border-red-500/40 bg-red-500/[0.06]" : "border-white/[0.07] bg-black/30 hover:border-white/15"}`}>
                        <Checkbox
                          data-testid="terms-checkbox"
                          checked={acceptTerms}
                          onCheckedChange={(v) => { setAcceptTerms(!!v); if (v) setTermsError(false); }}
                          aria-invalid={termsError}
                          className={`mt-0.5 ${termsError ? "border-red-500/70" : ""}`}
                        />
                        <span className="text-xs leading-relaxed text-zinc-400">
                          Li e aceito os{" "}
                          <Link to="/termos" target="_blank" className="font-medium text-zinc-200 underline decoration-red-500/50 underline-offset-2 transition-colors hover:text-red-400">
                            Termos de Serviço
                          </Link>{" "}
                          e a{" "}
                          <Link to="/privacidade" target="_blank" className="font-medium text-zinc-200 underline decoration-red-500/50 underline-offset-2 transition-colors hover:text-red-400">
                            Política de Privacidade
                          </Link>{" "}
                          do Lusorae.
                        </span>
                      </label>
                      {termsError && (
                        <FieldError id="terms-error" testId="terms-error">
                          Tens de aceitar os Termos de Serviço e a Política de Privacidade para criar conta.
                        </FieldError>
                      )}
                    </div>
                  )}

                  {/* ------------------------------------------ Erro servidor */}
                  {serverError && (
                    <div
                      role="alert"
                      aria-live="assertive"
                      className={`lus-auth-alert ${serverError.status === 429 ? "lus-auth-alert-amber text-amber-200" : "text-red-200"}`}
                    >
                      <div className="flex items-center gap-2">
                        {serverError.isNetwork
                          ? <WifiOff size={13} className="shrink-0 text-red-400" aria-hidden="true" />
                          : serverError.status === 429
                            ? <Clock size={13} className="shrink-0 text-amber-400" aria-hidden="true" />
                            : <AlertCircle size={13} className="shrink-0 text-red-400" aria-hidden="true" />}
                        <span className={`lus-auth-alert-kicker ${serverError.status === 429 ? "text-amber-400" : "text-red-400"}`}>
                          {serverError.isNetwork ? "Transmissão · Sem rede" : serverError.status === 429 ? "Transmissão · Bloqueio" : "Transmissão · Falha"}
                        </span>
                      </div>
                      <div className="mt-1.5 space-y-1.5">
                        <p data-testid="auth-error-message" className="text-xs leading-relaxed">{serverError.error}</p>
                        {serverError.status === 429 && isLocked && (
                          <p data-testid="auth-lockout-countdown" className="font-mono text-lg font-bold tabular-nums [text-shadow:0_0_14px_rgba(245,158,11,0.4)]">
                            {formatCountdown(lockoutSeconds)}
                          </p>
                        )}
                        {serverError.isNetwork && (
                          <button
                            type="button"
                            data-testid="auth-retry-button"
                            onClick={doSubmit}
                            disabled={submitting}
                            className="font-mono text-[10px] font-bold uppercase tracking-wider text-red-200 underline underline-offset-2 transition-colors hover:text-white disabled:opacity-50"
                          >
                            Tentar novamente
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ------------------------------------------------ Submit */}
                  <div className="space-y-2.5 pt-1">
                    <Button
                      data-testid="auth-submit-button"
                      type="submit"
                      disabled={submitDisabled}
                      aria-busy={submitting}
                      className="h-12 w-full rounded-lg font-display text-base font-bold uppercase tracking-[0.14em] shadow-[0_0_26px_rgba(220,38,38,0.4)]"
                    >
                      {submitting ? (
                        <span className="flex items-center gap-2" role="status">
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          {mode === "login" ? "A autenticar…" : "A fundar organização…"}
                        </span>
                      ) : isLocked ? (
                        <span className="flex items-center gap-2">
                          <Clock className="h-4 w-4" aria-hidden="true" /> Bloqueado · {formatCountdown(lockoutSeconds)}
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          {mode === "login" ? "Entrar na rede" : "Fundar organização"}
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </span>
                      )}
                    </Button>
                    <p className="flex items-center justify-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-600">
                      <Lock size={9} aria-hidden="true" /> Ligação cifrada · AES-256
                    </p>
                  </div>
                </div>
              </form>
            </div>

            {/* ------------------------------------------------ Rodapé legal */}
            <nav aria-label="Documentos legais" className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
              <Link data-testid="footer-link-terms" to="/termos" className="transition-colors hover:text-zinc-300">Termos</Link>
              <span className="text-zinc-800">·</span>
              <Link data-testid="footer-link-privacy" to="/privacidade" className="transition-colors hover:text-zinc-300">Privacidade</Link>
              <span className="text-zinc-800">·</span>
              <Link data-testid="footer-link-rgpd" to="/rgpd" className="transition-colors hover:text-zinc-300">RGPD</Link>
              <span className="text-zinc-800">·</span>
              <Link data-testid="footer-link-changelog" to="/changelog" className="transition-colors hover:text-zinc-300">Changelog</Link>
            </nav>
            <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-widest text-zinc-700">
              Simulador de império criminoso · Temporada 0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
