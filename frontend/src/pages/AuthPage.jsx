import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContextV2";
import { Button } from "../components/ui/button";
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

const GUEST_KEY = "lusorae_guest_credentials_v1";
const GUEST_READY_KEY = "lusorae_guest_initialized";

const randomHex = (bytes = 12) => {
  const values = new Uint8Array(bytes);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(values);
  } else {
    for (let i = 0; i < values.length; i += 1) {
      values[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(values, (v) => v.toString(16).padStart(2, "0")).join("");
};

const getGuestCredentials = () => {
  try {
    const existing = JSON.parse(localStorage.getItem(GUEST_KEY) || "null");
    if (existing?.email && existing?.password && existing?.orgName) return existing;
  } catch (_err) {
    // Gera novas credenciais técnicas abaixo.
  }

  const id = randomHex(12);
  const credentials = {
    email: `guest-${id}@lusorae.pt`,
    password: `Guest!${randomHex(18)}Aa1`,
    orgName: `Convidado ${id.slice(0, 6).toUpperCase()}`,
  };
  localStorage.setItem(GUEST_KEY, JSON.stringify(credentials));
  return credentials;
};

export default function AuthPage() {
  const {
    user,
    login,
    register,
    loginWithGoogle,
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

    const credentials = getGuestCredentials();
    const wasInitialized = localStorage.getItem(GUEST_READY_KEY) === "1";

    let result;

    if (wasInitialized) {
      result = await login(credentials.email, credentials.password);
      if (result.ok) {
        setBusy(null);
        return;
      }
    }

    result = await register(
      credentials.orgName,
      credentials.email,
      credentials.password,
      true
    );

    if (!result.ok && [400, 409].includes(result.status)) {
      result = await login(credentials.email, credentials.password);
    }

    if (result.ok) {
      localStorage.setItem(GUEST_READY_KEY, "1");
    } else if (result.status === 404 || result.isNetwork) {
      setError("O servidor do jogo está offline ou sem a API publicada. O modo convidado está pronto, mas precisa do backend para carregar o jogo completo.");
    } else {
      setError(result.error || "Não foi possível iniciar o modo convidado.");
    }

    setBusy(null);
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
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-red-300">
              <ShieldCheck size={13} />
              Rede operacional ativa
            </div>

            <h1 className="max-w-2xl font-display text-6xl font-black uppercase leading-[0.9] tracking-tight xl:text-7xl">
              Constrói o teu
              <span className="block text-red-500">império.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-zinc-400">
              Gere equipas, veículos, propriedades, operações e território num
              mapa vivo de Portugal. Entra com Google ou começa imediatamente
              como convidado.
            </p>

            <div className="mt-8 grid max-w-xl grid-cols-2 gap-3">
              {[
                [MapPinned, "Mapa vivo"],
                [Users, "Equipas e operacionais"],
                [Car, "Frota e logística"],
                [Building2, "Propriedades e QG"],
              ].map(([Icon, label]) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-lg border border-white/8 bg-white/[0.03] p-3 text-sm text-zinc-300"
                >
                  <Icon size={17} className="text-red-500" />
                  {label}
                </div>
              ))}
            </div>
          </section>

          <section className="mx-auto w-full max-w-md">
            <div className="rounded-2xl border border-white/10 bg-black/70 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
              <div className="text-center">
                <ShieldCheck className="mx-auto h-9 w-9 text-red-500" />
                <h2 className="mt-4 font-display text-4xl font-black uppercase tracking-tight">
                  Lusorae
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
                  Google Login fica disponível assim que o OAuth da app for
                  configurado. O modo convidado já pode ser utilizado.
                </p>
              )}

              {error && (
                <div
                  role="alert"
                  className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-center text-xs leading-relaxed text-red-300"
                >
                  {error}
                </div>
              )}

              <div className="mt-6 border-t border-white/8 pt-5 text-center text-[11px] leading-relaxed text-zinc-500">
                <p>
                  O progresso de convidado fica associado a este dispositivo.
                  Para sincronizar entre dispositivos, usa a Conta Google.
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
            </div>

            <p className="mt-4 text-center font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-700">
              Sem login por email · sem registo manual
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
