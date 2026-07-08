import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
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
import { LoadingScreen } from "./components/LoadingScreen";
import { Loader2 } from "lucide-react";

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
  if (user.role !== "admin") return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <BootProvider>
      <AuthProvider>
        <LoadingProvider>
          <BrowserRouter>
            <BootScreen />
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/termos" element={<LegalPage />} />
              <Route path="/privacidade" element={<LegalPage />} />
              <Route path="/rgpd" element={<LegalPage />} />
              <Route path="/changelog" element={<ChangelogPage />} />
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
              swipeDirections={["up", "left", "right"]}
              toastOptions={{ className: "lus-toast" }}
            />
          </BrowserRouter>
        </LoadingProvider>
      </AuthProvider>
    </BootProvider>
  );
}

export default App;
