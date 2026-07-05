import { Component } from "react";
import { AlertTriangle, RotateCcw, LogOut } from "lucide-react";

// Captura crashes de renderização (ex.: dados antigos de contas criadas em
// versões anteriores do jogo) e mostra o erro no ecrã em vez de ecrã preto.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error("=== RENDER CRASH ===");
    console.error(error);
    console.error(info?.componentStack);
  }

  handleLogout = () => {
    localStorage.removeItem("lusorae_access_token");
    localStorage.removeItem("lusorae_refresh_token");
    window.location.href = "/auth";
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 px-4">
        <div className="w-full max-w-md space-y-5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-9 w-9 flex-shrink-0 text-red-500" />
            <div>
              <p className="text-lg font-bold text-white">O jogo encontrou um erro</p>
              <p className="mt-0.5 text-xs text-zinc-400">
                Erro de renderização — envia uma captura deste ecrã ao suporte.
              </p>
            </div>
          </div>

          <div className="rounded border border-red-800/50 bg-red-950/30 p-3">
            <p className="break-words font-mono text-xs text-red-200">
              {String(this.state.error?.message || this.state.error)}
            </p>
          </div>

          {this.state.info?.componentStack && (
            <details className="text-[10px] text-zinc-500" open>
              <summary className="cursor-pointer hover:text-zinc-400">Onde aconteceu</summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-black/50 p-2 font-mono text-[9px]">
                {this.state.info.componentStack.split("\n").slice(0, 12).join("\n")}
              </pre>
            </details>
          )}

          <div className="space-y-2">
            <button
              onClick={() => window.location.reload()}
              className="flex w-full items-center justify-center gap-2 rounded bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
            >
              <RotateCcw className="h-4 w-4" /> Recarregar
            </button>
            <button
              onClick={this.handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
            >
              <LogOut className="h-4 w-4" /> Terminar sessão e voltar ao login
            </button>
          </div>
        </div>
      </div>
    );
  }
}
