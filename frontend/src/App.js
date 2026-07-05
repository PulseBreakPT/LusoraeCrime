import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { GameProvider } from "./context/GameContext";
import { SettingsProvider } from "./context/SettingsContext";
import { LoadingProvider } from "./context/LoadingContext";
import AuthPage from "./pages/AuthPage";
import GamePage from "./pages/GamePage";
import AdminPanel from "./pages/AdminPanel";
import { LoadingScreen } from "./components/LoadingScreen";
import { Loader2 } from "lucide-react";

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (user === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505]">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    );
  }
  if (user === false) return <Navigate to="/auth" replace />;
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
        </BrowserRouter>
        <Toaster position="top-center" theme="dark" toastOptions={{ style: { background: "rgba(10,10,10,0.9)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", backdropFilter: "blur(12px)" } }} />
      </LoadingProvider>
    </AuthProvider>
  );
}

export default App;
