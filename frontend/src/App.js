import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContextV2";
import { GameProvider } from "./context/GameContextV2";
import { BootProvider, useBoot } from "./context/BootContext";
import { SettingsProvider } from "./context/SettingsContext";
import { LoadingProvider } from "./context/LoadingContext";
import { BootScreen } from "./components/BootScreen";
import { ErrorBoundary } from "./components/ErrorBoundary";
import AuthPage from "./pages/AuthPage";
import GamePage from "./pages/GamePage";
import AdminPanel from "./pages/AdminPanel";
import LegalPage from "./pages/LegalPage";
import ChangelogPage from "./pages/ChangelogPage";
import DevLoadingPreview from "./pages/DevLoadingPreview";
import { LoadingScreen } from "./components/LoadingScreen";
import { Loader2, CheckCircle2, OctagonAlert, TriangleAlert, Info } from "lucide-react";

const toastIcon = (Icon, spin = false) => (
  <span className="lus-toast-ico">
    <Icon className={spin ? "h-[17px] w-[17px] animate-spin" : "h-[17px] w-[17px]"} strokeWidth={2.4} />
  </span>
);

const TOAST_ICONS = {
  success: toastIcon(CheckCircle2),
  error: toastIcon(OctagonAlert),
  warning: toastIcon(TriangleAlert),
  info: toastIcon(Info),
  loading: toastIcon(Loader2, true),
};

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  const { isBootReady, isBootLoading, isBootError } = useBoot();

  // User not yet determined
  if (user === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505]">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    );
  }

  // Not logged in
  if (user === false) return <Navigate to="/auth" replace />;

  // Wait for boot to complete
  if (isBootLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505]">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    );
  }

  // Boot failed, show error (BootScreen will display)
  if (isBootError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505]">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    );
  }

  // Boot completed successfully
  if (isBootReady) return children;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505]">
      <Loader2 className="h-8 w-8 animate-spin text-red-600" />
    </div>
  );
};

const AdminRoute = ({ children }) => {
  const { user } = useAuth();
  if (user === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505]">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    );
  }
  if (user === false) return <Navigate to="/auth" replace />;
  // Administradores têm acesso total; moderadores entram em modo de leitura.
  if (user.role !== "admin" && user.role !== "moderator") return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <BootProvider>
      <AuthProvider>
        <LoadingProvider>
          <BrowserRouter basename={process.env.PUBLIC_URL}>
            <BootScreen />
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/termos" element={<LegalPage />} />
              <Route path="/privacidade" element={<LegalPage />} />
              <Route path="/rgpd" element={<LegalPage />} />
              <Route path="/changelog" element={<ChangelogPage />} />
              <Route path="/dev/loading" element={<DevLoadingPreview />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <SettingsProvider>
                        <GameProvider>
                          <LoadingScreen />
                          <GamePage />
                        </GameProvider>
                      </SettingsProvider>
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/painel"
                element={
                  <AdminRoute>
                    <ErrorBoundary>
                      <AdminPanel />
                    </ErrorBoundary>
                  </AdminRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Toaster
              position="top-center"
              theme="dark"
              closeButton
              gap={6}
              visibleToasts={2}
              duration={3200}
              mobileOffset={{ top: 8, left: 8, right: 8 }}
              swipeDirections={["left", "right"]}
              icons={TOAST_ICONS}
              style={{ "--width": "300px" }}
              toastOptions={{ className: "lus-toast", duration: 3200 }}
            />
          </BrowserRouter>
        </LoadingProvider>
      </AuthProvider>
    </BootProvider>
  );
}

export default App;
