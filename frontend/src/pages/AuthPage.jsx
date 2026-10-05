import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContextV2";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Separator } from "../components/ui/separator";
import {
  Loader2,
  ShieldCheck,
  Gamepad2,
  LogIn,
  MapPinned,
  Users,
  Car,
  Building2,
} from "lucide-react";

const BG =
  "https://images.unsplash.com/photo-1731234361187-4702894e725a?crop=entropy&cs=srgb&fm=jpg&q=85&w=1920";

export default function AuthPage() {
  const {
    user,
    loginWithGoogle,
    playAsGuest,
    googleSignInEnabled,
  } = useAuth();

  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  if (user) return <Navigate to="/" replace />;

  const handleGoogle = async () => {
    if (!googleSignInEnabled || busy) return;
    setError("");
    setBusy("google");
    const result = await loginWithGoogle();
    setBusy(null);
    if (!result.ok) {
      if (result.status === 404 || result.isNetwork) {
        setError("O servidor do jogo não está disponível neste momento. O acesso Google volta a funcionar assim que o backend estiver online.");
      } else {
        setError(result.error || "Não foi possível entrar com Google.");
      }
    }
  };

  const handleGuest = async () => {
    if (busy) return;
    setError("");
    setBusy("guest");
    const result = await playAsGuest();
    setBusy(null);
    if (!result.ok) {
      setError(result.error || "Não foi possível iniciar o modo convidado local.");
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050506] text-white">
      <img
        src={BG}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover opacity-30"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-[#050506]/85 to-[#050506]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(239,68,68,0.12),transparent_34%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 sm:px-6">
        <div className="grid w-full gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <section className="hidden lg:block">
            <h1 className="max-w-2xl font-display text-6xl font-black uppercase leading-[0.9] tracking-tight xl:text-7xl">
              Constrói o teu
              <span className="block text-red-500">império.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-zinc-400">
              Gere equipas, veículos, propriedades, operações e território num
              mapa vivo de Portugal. Entra com Google ou começa imediatamente
              como convidado.
            </p>

            <div className="mt-8 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                [MapPinned, "Mapa vivo"],
                [Users, "Equipas e operacionais"],
                [Car, "Frota e logística"],
                [Building2, "Propriedades e QG"],
              ].map(([Icon, label]) => (
                <Card
                  key={label}
                  className="sub-card flex items-center gap-3 rounded-lg border-white/8 bg-white/[0.03] p-3 text-sm text-zinc-300"
                >
                  <Icon size={17} className="text-red-500" />
                  {label}
                </Card>
              ))}
            </div>
          </section>

          <section className="mx-auto w-full max-w-md">
            <Card className="sub-card rounded-2xl border-white/10 bg-black/70 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
              <div className="text-center">
                <ShieldCheck className="mx-auto h-9 w-9 text-red-500" />
                <h2 className="mt-4 font-display text-4xl font-black uppercase tracking-tight">
                  SUBMUNDO
                </h2>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.28em] text-red-400">
                  Escolhe como entrar
                </p>
              </div>

              <div className="mt-7 space-y-3">
                <Button
                  type="button"
                  data-testid="google-sign-in-button"
                  onClick={handleGoogle}
                  disabled={Boolean(busy) || !googleSignInEnabled}
                  className="h-12 w-full bg-white font-semibold text-zinc-950 hover:bg-zinc-100"
                >
                  {busy === "google" ? (
                    <Loader2 size={18} className="mr-2 animate-spin" />
                  ) : (
                    <LogIn size={18} className="mr-2" />
                  )}
                  Continuar com Google
                </Button>

                <Button
                  type="button"
                  data-testid="guest-play-button"
                  onClick={handleGuest}
                  disabled={Boolean(busy)}
                  className="h-12 w-full border border-red-500/30 bg-red-600 font-semibold text-white hover:bg-red-500"
                >
                  {busy === "guest" ? (
                    <Loader2 size={18} className="mr-2 animate-spin" />
                  ) : (
                    <Gamepad2 size={18} className="mr-2" />
                  )}
                  Jogar como convidado
                </Button>
              </div>

              {!googleSignInEnabled && (
                <p className="mt-3 text-center text-[11px] text-zinc-500">
                  O início de sessão com Google está temporariamente indisponível. Podes jogar como convidado.
                </p>
              )}

              {error && (
                <Alert variant="destructive" className="mt-4 border-red-500/20 bg-red-500/10 text-center">
                  <AlertDescription className="text-xs leading-relaxed text-red-300">{error}</AlertDescription>
                </Alert>
              )}

              <div className="mt-6 text-center text-[11px] leading-relaxed text-zinc-500">
                <Separator className="mb-5 bg-white/8" />
                <p>
                  No modo convidado, o progresso fica guardado apenas neste dispositivo.
                  Para o manter entre dispositivos, usa a Conta Google.
                </p>
                <p className="mt-3">
                  Ao continuar, aceitas os{" "}
                  <Link to="/termos" className="text-zinc-300 underline underline-offset-2">
                    Termos de Serviço
                  </Link>{" "}
                  e a{" "}
                  <Link to="/privacidade" className="text-zinc-300 underline underline-offset-2">
                    Política de Privacidade
                  </Link>.
                </p>
              </div>
            </Card>

          </section>
        </div>
      </div>
    </main>
  );
}
