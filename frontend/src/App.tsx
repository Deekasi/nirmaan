import { Navigate, Route, Routes, Link, NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./auth";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import Explore from "./pages/Explore";
import ProjectLayout from "./pages/project/ProjectLayout";
import Overview from "./pages/project/Overview";
import ResearchPage from "./pages/project/ResearchPage";
import ValidatePage from "./pages/project/ValidatePage";
import PlanPage from "./pages/project/PlanPage";
import BuildPage from "./pages/project/BuildPage";
import ReportPage from "./pages/project/ReportPage";

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted center">Loading…</p>;
  return user ? <>{children}</> : <Navigate to="/signin" replace />;
}

/** A brick with a plumb line: building, measured. */
function BrandMark() {
  return (
    <svg className="brand__mark" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="12" width="20" height="10" rx="2" fill="#E09A24" />
      <rect x="2" y="12" width="20" height="10" rx="2" fill="none" stroke="#F2F6FA" strokeOpacity="0.25" />
      <line x1="12" y1="1" x2="12" y2="10" stroke="#F2F6FA" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="10" r="1.6" fill="#F2F6FA" />
    </svg>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">
          <BrandMark />
          nirmaan
        </Link>
        {user && (
          <nav className="topbar__nav" aria-label="Main">
            <NavLink to="/" end>Projects</NavLink>
            <NavLink to="/explore">Explore</NavLink>
          </nav>
        )}
        {user && (
          <div className="topbar__user">
            <span>{user.name}</span>
            <button className="btn btn--onblue" onClick={signOut}>
              Sign out
            </button>
          </div>
        )}
      </header>
      {children}
    </>
  );
}

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/signin" element={<AuthPage />} />
        <Route path="/" element={<Protected><Dashboard /></Protected>} />
        <Route path="/explore" element={<Protected><Explore /></Protected>} />
        <Route path="/projects/:id" element={<Protected><ProjectLayout /></Protected>}>
          <Route index element={<Overview />} />
          <Route path="research" element={<ResearchPage />} />
          <Route path="validate" element={<ValidatePage />} />
          <Route path="plan" element={<PlanPage />} />
          <Route path="build" element={<BuildPage />} />
          <Route path="report" element={<ReportPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
