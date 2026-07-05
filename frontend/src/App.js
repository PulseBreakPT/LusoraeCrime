import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContextV2";
import { GameProvider } from "./context/GameContextV2";
import { BootProvider, useBoot } from "./context/BootContext";
import { SettingsProvider } from "./context/SettingsContext";
import { LoadingProvider } from "./context/LoadingContext";
import { BootScreen } from "./components/BootScreen";
import AuthPage from "./pages/AuthPage";
import GamePage from "./pages/GamePage";
import AdminPanel from "./pages/AdminPanel";
import { LoadingScreen } from "./components/LoadingScreen";
import { Loader2 } from "lucide-react";

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  const { isBootReady } = useBoot();

  if (user === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505]">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    );
  }
  if (user === false) return <Navigate to="/auth" replace />;
  if (!isBootReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505]">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    );
  }
  return children;
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
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <SettingsProvider>
                      <GameProvider>
                        <BootScreen />
                        <LoadingScreen />
                        <GamePage />
                      </GameProvider>
                    </SettingsProvider>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/painel"
                element={
                  <AdminRoute>
                    <AdminPanel />
                  </AdminRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Toaster position="top-center" theme="dark" toastOptions={{ style: { background: "rgba(10,10,10,0.9)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", backdropFilter: "blur(12px)" } }} />
          </BrowserRouter>
        </LoadingProvider>
      </AuthProvider>
    </BootProvider>
  );
}

export default App;
