import { useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContextV2";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Checkbox } from "../components/ui/checkbox";
import {
  Loader2, AlertCircle, ShieldCheck, Eye, EyeOff, MapPin, Users, TrendingUp,
  CheckCircle2, XCircle,
} from "lucide-react";
import { CURRENT_VERSION } from "../data/changelog";

const BG = "https://images.unsplash.com/photo-1731234361187-4702894e725a?crop=entropy&cs=srgb&fm=jpg&q=85&w=1920";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function passwordScore(pw) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}

const STRENGTH = [
  { label: "Muito fraca", bar: "bg-red-600", text: "text-red-500" },
  { label: "Fraca", bar: "bg-red-500", text: "text-red-400" },
  { label: "Razoável", bar: "bg-amber-500", text: "text-amber-400" },
  { label: "Forte", bar: "bg-lime-500", text: "text-lime-400" },
  { label: "Excelente", bar: "bg-emerald-500", text: "text-emerald-400" },
];

function meetsMinimum(pw) {
  return pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
}

function Requirement({ ok, children }) {
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-[10px] ${ok ? "text-emerald-400" : "text-zinc-500"}`}>
      {ok ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
      {children}
    </span>
  );
}

const FEATURES = [
  { icon: MapPin, title: "Mapa vivo de Lisboa", desc: "16 zonas, unidades em movimento e oportunidades em tempo real" },
  { icon: Users, title: "Operacionais únicos", desc: "14 especializações, talentos, lealdade e traições" },
  { icon: TrendingUp, title: "Economia viva", desc: "€ limpo, € sujo, lavagem, salários e fluxo de caixa por hora" },
];

export default function AuthPage() {
  const { user, login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const score = useMemo(() => passwordScore(password), [password]);
  const strength = STRENGTH[score];

  if (user) return <Navigate to="/" replace />;

  const switchMode = (m) => {
    setMode(m);
    setError("");
    setFieldErrors({});
  };

  const validate = () => {
    const errs = {};
    if (!EMAIL_RE.test(email.trim())) errs.email = "Introduz um email válido";
    if (mode === "register") {
      if (orgName.trim().length < 3) errs.orgName = "O nome da organização deve ter pelo menos 3 caracteres";
      if (!meetsMinimum(password)) errs.password = "Mínimo 8 caracteres, com letras e números";
      if (!acceptTerms) errs.terms = "Tens de aceitar os Termos e a Política de Privacidade";
    } else if (!password) {
      errs.password = "Introduz a tua palavra-passe";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!validate()) return;
    setLoading(true);
    const res = mode === "login"
      ? await login(email.trim(), password)
      : await register(orgName.trim(), email.trim(), password, acceptTerms);
    setLoading(false);
    if (!res.ok) setError(res.error);
  };

  const inputCls = (hasError) =>
    `h-11 border-white/10 bg-white/[0.06] text-white placeholder:text-zinc-600 transition-colors focus-visible:ring-primary/60 ${
      hasError ? "border-red-500/60 focus-visible:ring-red-500/50" : ""
    }`;

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      {/* Fundo */}
      <img src={BG} alt="Lisboa à noite" className="absolute inset-0 h-full w-full object-cover opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/75 to-background/40" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-background/60" />
      <div className="pointer-events-none absolute -top-32 left-1/3 h-[380px] w-[680px] -translate-x-1/2 rounded-full bg-primary/10 blur-[130px]" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-10 px-4 py-12 lg:flex-row lg:items-center lg:justify-between lg:gap-16 lg:px-8">

          {/* Coluna de branding */}
          <div className="w-full max-w-xl animate-slide-up lg:flex-1">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
              <ShieldCheck size={12} /> Portugal · Rede Criminosa
            </div>
            <h1 className="font-display text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
              LUSORAE
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-zinc-400">
              Não controlas uma personagem. <span className="text-white">Controlas um império.</span> Gere equipas,
              veículos e operações num mapa vivo de Lisboa.
            </p>

            <div className="mt-8 hidden space-y-3 lg:block">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="flex items-start gap-3.5 rounded-xl border border-white/[0.07] bg-black/40 p-3.5 backdrop-blur-md transition-colors hover:border-primary/25"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                    <Icon size={16} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-white">{title}</span>
                    <span className="block text-xs leading-relaxed text-zinc-500">{desc}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-8 hidden items-center gap-5 font-mono text-[10px] uppercase tracking-widest text-zinc-600 lg:flex">
              <span>60+ missões</span>
              <span className="h-3 w-px bg-white/15" />
              <span>30+ operacionais</span>
              <span className="h-3 w-px bg-white/15" />
              <span>16 zonas de Lisboa</span>
            </div>
          </div>

          {/* Cartão de autenticação */}
          <div className="w-full max-w-md animate-slide-up">
            <Card className="border-white/10 bg-black/75 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
              <CardHeader className="pb-3">
                <Tabs value={mode} onValueChange={switchMode}>
                  <TabsList className="grid w-full grid-cols-2 bg-white/5 p-1">
                    <TabsTrigger
                      data-testid="auth-tab-login"
                      value="login"
                      className="font-mono text-xs font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_0_18px_rgba(220,38,38,0.4)]"
                    >
                      Entrar
                    </TabsTrigger>
                    <TabsTrigger
                      data-testid="auth-tab-register"
                      value="register"
                      className="font-mono text-xs font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_0_18px_rgba(220,38,38,0.4)]"
                    >
                      Criar Império
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <CardTitle className="sr-only">{mode === "login" ? "Entrar" : "Criar organização"}</CardTitle>
                <CardDescription className="pt-1 text-zinc-500">
                  {mode === "login"
                    ? "Volta a assumir o controlo da tua organização."
                    : "Funda uma organização de raiz em Lisboa."}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={submit} className="space-y-4" noValidate>
                  {mode === "register" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="org-name" className="text-xs uppercase tracking-wider text-zinc-400">
                        Organização
                      </Label>
                      <Input
                        id="org-name"
                        data-testid="register-org-name-input"
                        placeholder="Nome da organização"
                        value={orgName}
                        onChange={(e) => { setOrgName(e.target.value); setFieldErrors((f) => ({ ...f, orgName: undefined })); }}
                        maxLength={40}
                        className={inputCls(fieldErrors.orgName)}
                      />
                      {fieldErrors.orgName && (
                        <p className="flex items-center gap-1 text-[11px] text-red-400" data-testid="error-org-name">
                          <AlertCircle size={11} /> {fieldErrors.orgName}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="auth-email" className="text-xs uppercase tracking-wider text-zinc-400">Email</Label>
                    <Input
                      id="auth-email"
                      data-testid="auth-email-input"
                      type="email"
                      placeholder="nome@exemplo.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setFieldErrors((f) => ({ ...f, email: undefined })); }}
                      autoComplete="email"
                      className={inputCls(fieldErrors.email)}
                    />
                    {fieldErrors.email && (
                      <p className="flex items-center gap-1 text-[11px] text-red-400" data-testid="error-email">
                        <AlertCircle size={11} /> {fieldErrors.email}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="auth-password" className="text-xs uppercase tracking-wider text-zinc-400">
                      Palavra-passe
                    </Label>
                    <div className="relative">
                      <Input
                        id="auth-password"
                        data-testid="auth-password-input"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setFieldErrors((f) => ({ ...f, password: undefined })); }}
                        autoComplete={mode === "login" ? "current-password" : "new-password"}
                        className={`${inputCls(fieldErrors.password)} pr-11`}
                      />
                      <button
                        type="button"
                        data-testid="auth-password-toggle"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-white"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {fieldErrors.password && (
                      <p className="flex items-center gap-1 text-[11px] text-red-400" data-testid="error-password">
                        <AlertCircle size={11} /> {fieldErrors.password}
                      </p>
                    )}

                    {mode === "register" && (
                      <div className="space-y-1.5 pt-1" data-testid="password-strength">
                        <div className="flex gap-1">
                          {[0, 1, 2, 3].map((i) => (
                            <span
                              key={i}
                              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                                password && i < score ? strength.bar : "bg-white/10"
                              }`}
                            />
                          ))}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex gap-3">
                            <Requirement ok={password.length >= 8}>8+ caracteres</Requirement>
                            <Requirement ok={/[A-Za-z]/.test(password)}>letras</Requirement>
                            <Requirement ok={/\d/.test(password)}>números</Requirement>
                          </div>
                          {password && (
                            <span className={`font-mono text-[10px] font-bold uppercase tracking-wider ${strength.text}`}>
                              {strength.label}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {mode === "register" && (
                    <div className="space-y-1.5">
                      <label
                        htmlFor="accept-terms"
                        className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors ${
                          fieldErrors.terms
                            ? "border-red-500/50 bg-red-500/[0.06]"
                            : acceptTerms
                              ? "border-primary/35 bg-primary/[0.06]"
                              : "border-white/10 bg-white/[0.03] hover:border-white/20"
                        }`}
                      >
                        <Checkbox
                          id="accept-terms"
                          data-testid="auth-terms-checkbox"
                          checked={acceptTerms}
                          onCheckedChange={(v) => { setAcceptTerms(v === true); setFieldErrors((f) => ({ ...f, terms: undefined })); }}
                          className="mt-0.5 border-white/30 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                        />
                        <span className="text-xs leading-relaxed text-zinc-400">
                          Li e aceito os{" "}
                          <Link
                            to="/termos"
                            target="_blank"
                            data-testid="auth-link-termos"
                            className="font-medium text-primary underline-offset-2 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Termos e Condições
                          </Link>{" "}
                          e a{" "}
                          <Link
                            to="/privacidade"
                            target="_blank"
                            data-testid="auth-link-privacidade"
                            className="font-medium text-primary underline-offset-2 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Política de Privacidade
                          </Link>
                        </span>
                      </label>
                      {fieldErrors.terms && (
                        <p className="flex items-center gap-1 text-[11px] text-red-400" data-testid="error-terms">
                          <AlertCircle size={11} /> {fieldErrors.terms}
                        </p>
                      )}
                    </div>
                  )}

                  {error && (
                    <Alert variant="destructive" className="border-destructive/40 bg-destructive/10 py-2.5">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription data-testid="auth-error-message" className="text-sm text-destructive">
                        {error}
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    data-testid="auth-submit-button"
                    type="submit"
                    disabled={loading}
                    className="h-11 w-full font-bold uppercase tracking-wider shadow-[0_0_24px_rgba(220,38,38,0.35)] transition-all hover:shadow-[0_0_32px_rgba(220,38,38,0.5)]"
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {mode === "login" ? "A entrar..." : "A fundar..."}
                      </span>
                    ) : mode === "login" ? (
                      "Entrar na rede"
                    ) : (
                      "Fundar organização"
                    )}
                  </Button>

                  {mode === "login" ? (
                    <p className="text-center text-xs text-zinc-600">
                      Ainda não tens organização?{" "}
                      <button type="button" onClick={() => switchMode("register")} className="font-medium text-primary hover:underline">
                        Cria o teu império
                      </button>
                    </p>
                  ) : (
                    <p className="text-center text-xs text-zinc-600">
                      Já tens conta?{" "}
                      <button type="button" onClick={() => switchMode("login")} className="font-medium text-primary hover:underline">
                        Entra na rede
                      </button>
                    </p>
                  )}
                </form>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Rodapé */}
        <footer className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-3 border-t border-white/[0.07] pt-5 sm:flex-row">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
              © 2026 Lusorae · Temporada 0 · v{CURRENT_VERSION}
            </span>
            <nav className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-widest">
              <Link to="/termos" data-testid="footer-link-termos" className="text-zinc-500 transition-colors hover:text-white">Termos</Link>
              <Link to="/privacidade" data-testid="footer-link-privacidade" className="text-zinc-500 transition-colors hover:text-white">Privacidade</Link>
              <Link to="/changelog" data-testid="footer-link-changelog" className="text-zinc-500 transition-colors hover:text-white">Changelog</Link>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
}
