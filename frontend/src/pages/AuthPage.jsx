import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Loader2 } from "lucide-react";

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
    <div className="relative min-h-screen w-full overflow-hidden bg-[#050505]">
      <img src={BG} alt="Lisboa à noite" className="absolute inset-0 h-full w-full object-cover opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/70 to-[#050505]/40" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 md:justify-start md:px-16 lg:px-24">
        <div className="w-full max-w-md animate-slide-up">
          <div className="mb-8">
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-red-500">Lisboa · Rede Criminosa</p>
            <h1 className="mt-2 font-display text-5xl font-bold tracking-tight text-white sm:text-6xl">LUSORAE</h1>
            <p className="mt-3 text-sm text-zinc-400">
              Não controlas uma personagem. Controlas um império. Gere equipas, veículos e operações num mapa vivo de Lisboa.
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-black/75 p-6 shadow-2xl backdrop-blur-xl">
            <div className="mb-5 flex gap-1 rounded-md bg-white/5 p-1">
              <button
                data-testid="auth-tab-login"
                onClick={() => { setMode("login"); setError(""); }}
                className={`flex-1 rounded px-3 py-2 text-sm font-semibold uppercase tracking-wider transition-colors ${mode === "login" ? "bg-white text-black" : "text-zinc-400 hover:text-white"}`}
              >
                Entrar
              </button>
              <button
                data-testid="auth-tab-register"
                onClick={() => { setMode("register"); setError(""); }}
                className={`flex-1 rounded px-3 py-2 text-sm font-semibold uppercase tracking-wider transition-colors ${mode === "register" ? "bg-white text-black" : "text-zinc-400 hover:text-white"}`}
              >
                Criar Império
              </button>
            </div>

            <form onSubmit={submit} className="space-y-3">
              {mode === "register" && (
                <Input
                  data-testid="register-org-name-input"
                  placeholder="Nome da organização"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                  minLength={3}
                  className="border-white/10 bg-white/5 text-white placeholder:text-zinc-500"
                />
              )}
              <Input
                data-testid="auth-email-input"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-white/10 bg-white/5 text-white placeholder:text-zinc-500"
              />
              <Input
                data-testid="auth-password-input"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="border-white/10 bg-white/5 text-white placeholder:text-zinc-500"
              />

              {error && (
                <p data-testid="auth-error-message" className="text-sm text-red-500">{error}</p>
              )}

              <Button
                data-testid="auth-submit-button"
                type="submit"
                disabled={loading}
                className="w-full bg-white font-bold uppercase tracking-wider text-black hover:bg-gray-200"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "login" ? "Entrar na rede" : "Fundar organização"}
              </Button>
            </form>
          </div>

          <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            Simulador de império criminoso · MVP Temporada 0
          </p>
        </div>
      </div>
    </div>
  );
}
