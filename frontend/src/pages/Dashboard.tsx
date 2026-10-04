import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, type ProjectSummary } from "../api";
import { useAuth } from "../auth";
import { StageMeter } from "../StageRail";
import { TEMPLATE_INFO } from "./project/PlanPage";

type Tab = "all" | "active" | "finished";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(Boolean(params.get("idea")));
  const [name, setName] = useState(params.get("name") ?? "");
  const [idea, setIdea] = useState(params.get("idea") ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listProjects().then(setProjects).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (params.get("idea")) setParams({}, { replace: true }); // prefill once, then clean the URL
  }, [params, setParams]);

  const counts = useMemo(() => {
    const list = projects ?? [];
    return { all: list.length, active: list.filter((p) => p.status !== "finished").length, finished: list.filter((p) => p.status === "finished").length };
  }, [projects]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (projects ?? []).filter((p) =>
      (tab === "all" || (tab === "finished" ? p.status === "finished" : p.status !== "finished")) &&
      (!q || p.name.toLowerCase().includes(q) || p.idea.toLowerCase().includes(q)),
    );
  }, [projects, tab, query]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const p = await api.createProject(name, idea);
      navigate(`/projects/${p.id}/research`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const empty = projects !== null && projects.length === 0;
  const firstName = user?.name.split(" ")[0] ?? "";

  return (
    <>
      <header className="band blueprint">
        <div className="band__inner">
          <div className="band__head">
            <div>
              <h1>{empty ? `Welcome, ${firstName}` : "Your projects"}</h1>
              <p className="lede" style={{ marginTop: "0.6rem" }}>
                {empty
                  ? "Describe an idea in a few lines, or find one on the Explore page. Nirmaan will research it, check it and help you build the first version."
                  : "Everything is saved as you go. Finished projects keep their GitHub and live links."}
              </p>
            </div>
            <div className="row">
              <Link to="/explore" className="btn btn--onblue btn--big">Find an idea</Link>
              {!showForm && !empty && <button className="btn btn--build btn--big" onClick={() => setShowForm(true)}>New project</button>}
            </div>
          </div>
        </div>
      </header>

      <main className="page">
        {error && <p className="error" role="alert" style={{ marginBottom: "1.5rem" }}>{error}</p>}

        {(showForm || empty) && (
          <form className="panel newproject" onSubmit={create}>
            <h2>{empty ? "Start your first project" : "New project"}</h2>
            <label>
              Project name
              <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder="e.g. Mess feedback app" />
            </label>
            <label>
              Describe your idea
              <textarea value={idea} onChange={(e) => setIdea(e.target.value)} required minLength={10} rows={4}
                placeholder="Who is it for, and what problem does it solve? Rough is fine, and spelling mistakes are okay." />
            </label>
            <div className="row">
              <button className="btn btn--build" disabled={busy}>{busy ? "Creating…" : "Create and start research"}</button>
              {!empty && <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)}>Cancel</button>}
            </div>
          </form>
        )}

        {projects === null && !error && <p className="muted">Loading projects…</p>}

        {projects && projects.length > 0 && (
          <>
            <div className="libbar">
              <div className="libtabs" role="tablist" aria-label="Filter projects">
                {(["all", "active", "finished"] as Tab[]).map((t) => (
                  <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
                    {t === "all" ? "All" : t === "active" ? "In progress" : "Finished"} <span>{counts[t]}</span>
                  </button>
                ))}
              </div>
              <input className="search" type="search" placeholder="Search projects" aria-label="Search projects" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>

            {visible.length === 0 ? (
              <p className="muted empty-filter">No projects match. Try another tab or search.</p>
            ) : (
              <ul className="projects">
                {visible.map((p) => (
                  <li key={p.id}>
                    <Link to={`/projects/${p.id}`} className="project">
                      <div>
                        <h3>{p.name}</h3>
                        <p className="project__idea">{p.idea}</p>
                        <div className="chips">
                          {p.verdict && <span className={`badge badge--${p.verdict}`}>{p.verdict}</span>}
                          {p.template && <span className="chip">{TEMPLATE_INFO[p.template].title}</span>}
                          {p.github_url && <span className="chip">GitHub</span>}
                          {p.live_url && <span className="chip">Live</span>}
                        </div>
                      </div>
                      {p.status === "finished" ? (
                        <div className="meter"><span className="status-chip status-chip--light">Finished</span>
                          {p.finished_at && <small>{new Date(p.finished_at).toLocaleDateString()}</small>}</div>
                      ) : (
                        <StageMeter stage={p.stage} />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </>
  );
}
