import { Navigate, Route, Routes, Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./auth";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import ProjectPage from "./pages/ProjectPage";

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted center">Loading…</p>;
  return user ? <>{children}</> : <Navigate to="/signin" replace />;
}

function Shell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">
          nirmaan
        </Link>
        {user && (
          <div className="topbar__user">
            <span className="muted">{user.name}</span>
            <button className="btn btn--ghost" onClick={signOut}>
              Sign out
            </button>
          </div>
        )}
      </header>
      <main className="page">{children}</main>
    </>
  );
}

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/signin" element={<AuthPage />} />
        <Route path="/" element={<Protected><Dashboard /></Protected>} />
        <Route path="/projects/:id" element={<Protected><ProjectPage /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
