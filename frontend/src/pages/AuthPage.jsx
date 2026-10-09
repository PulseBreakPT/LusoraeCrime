import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContextV2";
import { Button } from "../components/ui/button";
import { Alert, AlertDescription } from "../components/ui/alert";
import { ArrowUpRight, Crown, Gamepad2, LockKeyhole, LogIn, Loader2, ShieldCheck } from "lucide-react";

/**
 * Immediate access gateway: no cinematic splash, dramatic cover, animation,
 * staged entrance, or forced loading sequence. Login and guest mode preserve
 * their existing authentication and storage semantics.
 */
export default function AuthPage() {
  const { user, loginWithGoogle, playAsGuest, googleSignInEnabled } = useAuth();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  if (user) return <Navigate to="/" replace />;

  const handleGoogle = async () => {
    if (!googleSignInEnabled || busy) return;
    setError("");
    setBusy("google");
    try {
      const result = await loginWithGoogle();
      if (!result.ok) {
        setError(result.status === 404 || result.isNetwork
          ? "O servidor não está disponível neste momento. Podes entrar em modo convidado."
          : (result.error || "Não foi possível entrar com Google."));
      }
    } catch {
      setError("Falha na ligação ao serviço de autenticação.");
    } finally {
      setBusy(null);
    }
  };

  const handleGuest = async () => {
    if (busy) return;
    setError("");
    setBusy("guest");
    try {
      const result = await playAsGuest();
      if (!result.ok) setError(result.error || "Não foi possível iniciar o modo convidado local.");
    } catch {
      setError("Não foi possível carregar os dados locais. Verifica o armazenamento do dispositivo.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="sub-auth-shell noir-access-shell" aria-labelledby="access-title">
      <div className="noir-access-layout">
        <header className="noir-access-topbar">
          <div className="noir-access-identity">
            <span className="noir-access-crest"><Crown size={20} aria-hidden="true" /></span>
            <span className="noir-access-logo">SUB<span>MUNDO</span></span>
            <span className="noir-access-edition">BLACKLIST OS / 01</span>
          </div>
          <span className="noir-access-status"><span className="noir-signal-dot" /> ACESSO RESTRITO</span>
        </header>

        <section className="noir-access-card" aria-labelledby="access-title">
          <div className="noir-access-card-line">
            <span><LockKeyhole size={14} /> CENTRO DE COMANDO</span>
            <span>PORTUGAL · PT</span>
          </div>

          <div className="noir-access-emblem" aria-hidden="true"><Crown size={32} strokeWidth={1.5} /></div>
          <p className="noir-access-eyebrow">ENTRADA DIRETA / SUBMUNDO</p>
          <h1 id="access-title">ENTRA NO <span>TEU IMPÉRIO.</span></h1>
          <p className="noir-access-description">
            Escolhe como queres jogar e entra diretamente na tua organização.
            Sem apresentações, sem esperas artificiais.
          </p>

          <div className="noir-access-actions">
            <Button type="button" data-testid="google-sign-in-button"
              onClick={handleGoogle} disabled={Boolean(busy) || !googleSignInEnabled}
              className="noir-access-google w-full">
              {busy === "google" ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
              CONTINUAR COM GOOGLE
              <ArrowUpRight size={15} className="ml-auto" />
            </Button>

            <Button type="button" data-testid="guest-play-button"
              onClick={handleGuest} disabled={Boolean(busy)}
              className="noir-access-guest w-full">
              {busy === "guest" ? <Loader2 size={18} className="animate-spin" /> : <Gamepad2 size={18} />}
              JOGAR COMO CONVIDADO
              <ArrowUpRight size={15} className="ml-auto" />
            </Button>
          </div>

          {!googleSignInEnabled && (
            <p className="noir-access-note">O acesso Google está temporariamente indisponível. O modo convidado continua disponível.</p>
          )}

          {error && (
            <Alert variant="destructive" className="noir-access-error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="noir-access-privacy">
            <ShieldCheck size={16} />
            <p>Em modo convidado, o progresso fica guardado apenas neste dispositivo. Para jogar entre dispositivos, entra com a tua conta.</p>
          </div>
          <nav className="noir-access-links" aria-label="Informação legal">
            <Link to="/termos">TERMOS DE UTILIZAÇÃO <ArrowUpRight size={13} /></Link>
            <Link to="/privacidade">PRIVACIDADE <ArrowUpRight size={13} /></Link>
          </nav>
        </section>

        <footer className="noir-access-footer">
          <span>SUBMUNDO / BLACKLIST</span>
          <span>UM IMPÉRIO. UM COMANDO.</span>
        </footer>
      </div>
    </main>
  );
}
