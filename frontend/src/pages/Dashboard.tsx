import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type Project } from "../api";
import { StageRail } from "../StageRail";

export default function Dashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listProjects().then(setProjects).catch((e) => setError(e.message));
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const p = await api.createProject(name, idea);
      navigate(`/projects/${p.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const empty = projects !== null && projects.length === 0;

  return (
    <>
      <div className="page__head">
        <h1>Your projects</h1>
        {!showForm && !empty && (
          <button className="btn btn--primary" onClick={() => setShowForm(true)}>
            New project
          </button>
        )}
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {(showForm || empty) && (
        <form className="panel newproject" onSubmit={create}>
          <h2>{empty ? "Start your first project" : "New project"}</h2>
          <label>
            Project name
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder="Mess feedback app" />
          </label>
          <label>
            Describe your idea
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              required
              minLength={10}
              rows={4}
              placeholder="Who is it for, and what problem does it solve? Rough is fine."
            />
          </label>
          <div className="row">
            <button className="btn btn--primary" disabled={busy}>
              {busy ? "Creating…" : "Create project"}
            </button>
            {!empty && (
              <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {projects === null && !error && <p className="muted">Loading projects…</p>}

      {projects && projects.length > 0 && (
        <ul className="projects">
          {projects.map((p) => (
            <li key={p.id}>
              <Link to={`/projects/${p.id}`} className="project">
                <div className="project__top">
                  <h3>{p.name}</h3>
                  <time className="muted" dateTime={p.updated_at}>
                    {new Date(p.updated_at).toLocaleDateString()}
                  </time>
                </div>
                <p className="project__idea">{p.idea}</p>
                <StageRail stage={p.stage} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
