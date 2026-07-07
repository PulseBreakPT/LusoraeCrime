import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContextV2";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Loader2, AlertCircle, ShieldCheck } from "lucide-react";

const BG = "https://images.unsplash.com/photo-1731234361187-4702894e725a?crop=entropy&cs=srgb&fm=jpg&q=85&w=1920";

export default function AuthPage() {
  const { user, login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = mode === "login" ? await login(email, password) : await register(orgName, email, password);
    setLoading(false);
    if (!res.ok) setError(res.error);
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      <img src={BG} alt="Lisboa à noite" className="lus-kenburns absolute inset-0 h-full w-full object-cover opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/40" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_20%_30%,rgba(220,38,38,0.08),transparent_70%)]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 md:justify-start md:px-16 lg:px-24">
        <div className="w-full max-w-md animate-slide-up">
          <div className="mb-6 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.35em] text-primary">
            <ShieldCheck size={14} /> Lisboa · Rede Criminosa
          </div>
          <h1 className="lus-title font-display text-6xl font-bold uppercase leading-none tracking-tight sm:text-7xl">Lusorae</h1>
          <div className="mt-2 h-0.5 w-24 bg-gradient-to-r from-primary via-primary/60 to-transparent" />
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Não controlas uma personagem. Controlas um império. Gere equipas, veículos e operações num mapa vivo de Lisboa.
          </p>

          <Card className="lus-panel relative mt-8 overflow-hidden border-white/10 shadow-2xl">
            <CardHeader className="pb-3">
              <Tabs value={mode} onValueChange={(m) => { setMode(m); setError(""); }}>
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
                {mode === "login" ? "Volta a assumir o controlo da tua organização." : "Funda uma organização de raiz em Lisboa."}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={submit} className="space-y-3">
                {mode === "register" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="org-name" className="text-xs uppercase tracking-wider text-zinc-400">Organização</Label>
                    <Input
                      id="org-name"
                      data-testid="register-org-name-input"
                      placeholder="Nome da organização"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      required
                      minLength={3}
                      className="border-white/10 bg-white/5 text-white placeholder:text-zinc-500"
                    />
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
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="border-white/10 bg-white/5 text-white placeholder:text-zinc-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="auth-password" className="text-xs uppercase tracking-wider text-zinc-400">Palavra-passe</Label>
                  <Input
                    id="auth-password"
                    data-testid="auth-password-input"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="border-white/10 bg-white/5 text-white placeholder:text-zinc-500"
                  />
                </div>

                {error && (
                  <Alert variant="destructive" className="border-destructive/40 bg-destructive/10 py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription data-testid="auth-error-message" className="text-destructive">{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  data-testid="auth-submit-button"
                  type="submit"
                  disabled={loading}
                  className="w-full font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(220,38,38,0.35)]"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "login" ? "Entrar na rede" : "Fundar organização"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            Simulador de império criminoso · Temporada 0
          </p>
        </div>
      </div>
    </div>
  );
}
