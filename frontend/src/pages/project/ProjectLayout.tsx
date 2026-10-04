import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useParams } from "react-router-dom";
import { api, type Project, type Results } from "../../api";
import { StageRail } from "../../StageRail";
import { STAGE_TABS, unlocked, type ProjectCtx } from "./context";

export default function ProjectLayout() {
  const { id } = useParams();
  const pid = Number(id);
  const [project, setProject] = useState<Project | null>(null);
  const [results, setResults] = useState<Results>({});
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const [p, r] = await Promise.all([api.getProject(pid), api.getResults(pid)]);
    setProject(p);
    setResults(r);
    return r;
  }, [pid]);

  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, [refresh]);

  if (!project) {
    return (
      <main className="page">
        {error ? (
          <>
            <p className="error" role="alert">{error}</p>
            <p style={{ marginTop: "1rem" }}><Link to="/">Back to projects</Link></p>
          </>
        ) : (
          <p className="muted">Loading project…</p>
        )}
      </main>
    );
  }

  const open = unlocked(results);
  const ctx: ProjectCtx = { project, results, refresh, setProject };

  return (
    <>
      <header className="band blueprint">
        <div className="band__inner">
          <Link to="/" className="back">Back to projects</Link>
          <div className="row" style={{ gap: "1rem" }}>
            <h1>{project.name}</h1>
            {project.status === "finished" && <span className="status-chip">Finished</span>}
          </div>
          <p className="lede">{project.idea}</p>
          <StageRail stage={project.stage} />
        </div>
      </header>

      <nav className="tabs" aria-label="Project sections">
        <div className="tabs__inner">
          <NavLink to="" end>Overview</NavLink>
          {STAGE_TABS.map((t) => (
            <NavLink key={t.path} to={t.path} className={open[t.path] ? "" : "is-locked"}>{t.label}</NavLink>
          ))}
          <NavLink to="report" className={open.report ? "" : "is-locked"}>Report</NavLink>
        </div>
      </nav>

      <main className="page">
        <Outlet context={ctx} />
      </main>
    </>
  );
}
