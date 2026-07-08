import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContextV2";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Checkbox } from "../components/ui/checkbox";
import { evaluatePassword } from "../lib/passwordStrength";
import {
  Loader2, AlertCircle, ShieldCheck, Eye, EyeOff, Check, X,
  MapPinned, Users, Landmark, WifiOff, Clock, ArrowUpCircle, KeyRound,
} from "lucide-react";

const BG = "https://images.unsplash.com/photo-1731234361187-4702894e725a?crop=entropy&cs=srgb&fm=jpg&q=85&w=1920";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ORG_FORBIDDEN_RE = /[<>{}[\]\\/;`]/;

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

const Feature = ({ icon: Icon, title, text }) => (
  <div className="group flex items-start gap-3.5">
    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-red-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors group-hover:border-red-500/30 group-hover:bg-red-500/5">
      <Icon size={16} aria-hidden="true" />
    </div>
    <div>
      <div className="text-sm font-semibold text-zinc-100">{title}</div>
      <div className="mt-0.5 text-xs leading-relaxed text-zinc-500">{text}</div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------
export default function AuthPage() {
  const { user, login, register, checkAvailability } = useAuth();
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

  if (user) return <Navigate to="/" replace />;

  const isLocked = lockoutSeconds > 0;
  const submitDisabled = submitting || isLocked;

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      <img src={BG} alt="" aria-hidden="true" className="lus-kenburns absolute inset-0 h-full w-full object-cover opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/40" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_20%_30%,rgba(220,38,38,0.08),transparent_70%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 sm:px-8 lg:px-12">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[1fr_440px] lg:gap-16">

          {/* ------------------------------------------------ Painel de marca */}
          <div className="animate-slide-up">
            <div className="mb-5 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.35em] text-primary">
              <ShieldCheck size={14} aria-hidden="true" /> Lisboa · Rede Criminosa
            </div>
            <h1 className="lus-title font-display text-5xl font-bold uppercase leading-none tracking-tight sm:text-7xl">Lusorae</h1>
            <div className="mt-3 h-0.5 w-24 bg-gradient-to-r from-primary via-primary/60 to-transparent" />
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              Não controlas uma personagem. Controlas um império. Gere equipas, veículos e operações
              num mapa vivo de Lisboa — a cidade não dorme, e a tua organização também não.
            </p>

            <div className="mt-9 hidden max-w-sm flex-col gap-5 lg:flex">
              <Feature icon={MapPinned} title="Mapa vivo de Lisboa" text="16 zonas, oportunidades em tempo real e unidades a mover-se pela cidade." />
              <Feature icon={Users} title="A tua gente é o coração" text="14 especializações, talentos, lealdade e moral — cada contratação conta." />
              <Feature icon={Landmark} title="Economia dupla" text="Dinheiro limpo, dinheiro sujo e a arte de o lavar sem atrair o calor." />
            </div>

            <div className="mt-9 hidden items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-zinc-600 lg:flex">
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

          {/* ------------------------------------------------------- Cartão */}
          <div className="w-full animate-slide-up" style={{ animationDelay: "80ms" }}>
            <Card className="lus-panel relative overflow-hidden border-white/10 shadow-2xl">
              <CardHeader className="pb-3">
                <Tabs value={mode} onValueChange={switchMode}>
                  <TabsList className="grid w-full grid-cols-2 bg-white/5">
                    <TabsTrigger
                      data-testid="auth-tab-login"
                      value="login"
                      className="font-mono text-xs font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      Entrar
                    </TabsTrigger>
                    <TabsTrigger
                      data-testid="auth-tab-register"
                      value="register"
                      className="font-mono text-xs font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      Criar Império
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <CardTitle className="sr-only">{mode === "login" ? "Entrar" : "Criar organização"}</CardTitle>
                <CardDescription className="text-zinc-500">
                  {mode === "login"
                    ? "A cidade não parou enquanto estiveste fora. Retoma o comando."
                    : "Escolhe um nome. Lisboa trata de o pôr à prova."}
                </CardDescription>
              </CardHeader>

              <CardContent>
                {sessionExpired && (
                  <div
                    data-testid="auth-expired-banner"
                    role="status"
                    className="mb-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300"
                  >
                    <KeyRound size={14} className="mt-px shrink-0" aria-hidden="true" />
                    <span>A tua sessão expirou por segurança. Inicia sessão novamente para retomar o comando.</span>
                  </div>
                )}

                <form onSubmit={submit} noValidate className="space-y-3.5">
                  {/* ------------------------------------------- Organização */}
                  {mode === "register" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="org-name" className="text-xs uppercase tracking-wider text-zinc-400">Organização</Label>
                      <div className="relative">
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
                          className={`border-white/10 bg-white/5 pr-9 text-white placeholder:text-zinc-500 ${showError("orgName") ? "border-red-500/60 focus-visible:ring-red-500/40" : availability.orgName === "available" ? "border-emerald-500/40" : ""}`}
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
                    <Label htmlFor="auth-email" className="text-xs uppercase tracking-wider text-zinc-400">Email</Label>
                    <div className="relative">
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
                        autoComplete={mode === "login" ? "email" : "email"}
                        aria-invalid={!!showError("email")}
                        aria-describedby={showError("email") ? "email-error" : undefined}
                        className={`border-white/10 bg-white/5 pr-9 text-white placeholder:text-zinc-500 ${showError("email") ? "border-red-500/60 focus-visible:ring-red-500/40" : mode === "register" && availability.email === "available" ? "border-emerald-500/40" : ""}`}
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
                    <Label htmlFor="auth-password" className="text-xs uppercase tracking-wider text-zinc-400">Palavra-passe</Label>
                    <div className="relative">
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
                        className={`border-white/10 bg-white/5 pr-10 text-white placeholder:text-zinc-500 ${showError("password") ? "border-red-500/60 focus-visible:ring-red-500/40" : ""}`}
                      />
                      <button
                        type="button"
                        data-testid="auth-password-toggle"
                        onClick={() => setShowPassword((s) => !s)}
                        tabIndex={-1}
                        aria-label={showPassword ? "Esconder palavra-passe" : "Mostrar palavra-passe"}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500 transition-colors hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
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
                      <div data-testid="password-strength-meter" className="space-y-2 pt-1">
                        <div className="flex items-center gap-2">
                          <div className="flex flex-1 gap-1" aria-hidden="true">
                            {[1, 2, 3, 4].map((i) => (
                              <div
                                key={i}
                                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${values.password && i <= strength.score ? strength.barColor : "bg-white/10"}`}
                              />
                            ))}
                          </div>
                          {values.password && (
                            <span className={`font-mono text-[10px] font-bold uppercase tracking-wider ${strength.textColor}`} role="status">
                              {strength.label}
                            </span>
                          )}
                        </div>
                        <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
                          {strength.requirements.map((r) => (
                            <li key={r.key} className={`flex items-center gap-1.5 text-[11px] transition-colors ${r.met ? "text-emerald-400" : "text-zinc-500"}`}>
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
                      <Label htmlFor="auth-confirm" className="text-xs uppercase tracking-wider text-zinc-400">Confirmar palavra-passe</Label>
                      <div className="relative">
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
                          className={`border-white/10 bg-white/5 pr-10 text-white placeholder:text-zinc-500 ${showError("confirm") ? "border-red-500/60 focus-visible:ring-red-500/40" : values.confirm && values.confirm === values.password ? "border-emerald-500/40" : ""}`}
                        />
                        <button
                          type="button"
                          data-testid="auth-confirm-toggle"
                          onClick={() => setShowConfirm((s) => !s)}
                          tabIndex={-1}
                          aria-label={showConfirm ? "Esconder confirmação" : "Mostrar confirmação"}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500 transition-colors hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
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
                      <label className="flex cursor-pointer items-start gap-2.5">
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
                      className={`flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-xs ${serverError.status === 429 ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-destructive/40 bg-destructive/10 text-red-300"}`}
                    >
                      {serverError.isNetwork
                        ? <WifiOff size={14} className="mt-px shrink-0" aria-hidden="true" />
                        : serverError.status === 429
                          ? <Clock size={14} className="mt-px shrink-0" aria-hidden="true" />
                          : <AlertCircle size={14} className="mt-px shrink-0" aria-hidden="true" />}
                      <div className="flex-1 space-y-1.5">
                        <p data-testid="auth-error-message">{serverError.error}</p>
                        {serverError.status === 429 && isLocked && (
                          <p data-testid="auth-lockout-countdown" className="font-mono text-sm font-bold tabular-nums">
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
                  <Button
                    data-testid="auth-submit-button"
                    type="submit"
                    disabled={submitDisabled}
                    aria-busy={submitting}
                    className="w-full font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(220,38,38,0.35)]"
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
                    ) : mode === "login" ? "Entrar na rede" : "Fundar organização"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* ------------------------------------------------ Rodapé legal */}
            <nav aria-label="Documentos legais" className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
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
