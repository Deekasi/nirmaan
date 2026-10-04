import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { MethodBadge } from "../../components";
import { useProject } from "./context";
import { TEMPLATE_INFO } from "./PlanPage";

export default function Overview() {
  const { project, results, setProject } = useProject();
  const navigate = useNavigate();
  const { research, validate, plan, build } = results;
  const [editing, setEditing] = useState(false);
  const [github, setGithub] = useState(project.github_url ?? "");
  const [live, setLive] = useState(project.live_url ?? "");
  const [notes, setNotes] = useState(project.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editIdea, setEditIdea] = useState(false);
  const [name, setName] = useState(project.name);
  const [idea, setIdea] = useState(project.idea);
  const [ideaError, setIdeaError] = useState("");

  async function saveIdea(e: FormEvent) {
    e.preventDefault();
    setIdeaError("");
    try {
      setProject(await api.updateProject(project.id, { name, idea }));
      setEditIdea(false);
    } catch (err) {
      setIdeaError((err as Error).message);
    }
  }

  const next = !research ? ["research", "Research the market"]
    : !validate ? ["validate", "Validate the idea"]
    : !plan ? ["plan", "Plan version one"]
    : !build ? ["plan", "Build your starter project"]
    : ["build", "Continue your missions"];

  async function save(e: FormEvent, status: "finished" | "active" = "finished") {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const updated = await api.updateProject(project.id, { status, github_url: github, live_url: live, notes });
      setProject(updated);
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reopen() {
    setBusy(true);
    try {
      setProject(await api.updateProject(project.id, { status: "active" }));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete "${project.name}"? This can't be undone.`)) return;
    await api.deleteProject(project.id);
    navigate("/");
  }

  const missionsDone = build?.missions_done?.length ?? 0;
  const missionsTotal = build?.missions?.length ?? 0;
  const finished = project.status === "finished";

  return (
    <div className="stack">
      {!finished && (
        <section className="nextstep">
          <div>
            <h2>Next: {next[1]}</h2>
            <p className="muted">Each step builds on the one before, and everything is saved as you go.</p>
          </div>
          <Link to={next[0]} className="btn btn--build btn--big">{next[1]}</Link>
        </section>
      )}

      <section className="panel">
        {editIdea ? (
          <form className="finish" onSubmit={saveIdea}>
            <h2>Edit name and idea</h2>
            <label>Project name<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} /></label>
            <label>Idea<textarea rows={4} value={idea} onChange={(e) => setIdea(e.target.value)} required minLength={10} /></label>
            <p className="muted">After changing the idea, run Research again so everything matches.</p>
            {ideaError && <p className="error" role="alert">{ideaError}</p>}
            <div className="row">
              <button className="btn btn--build">Save</button>
              <button type="button" className="btn btn--ghost" onClick={() => { setEditIdea(false); setName(project.name); setIdea(project.idea); }}>Cancel</button>
            </div>
          </form>
        ) : (
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <h3>Your idea</h3>
              <p className="prose">{project.idea}</p>
            </div>
            <button className="btn btn--ghost" onClick={() => setEditIdea(true)}>Edit idea</button>
          </div>
        )}
      </section>

      <section className="overview">
        <Link to="research" className="ov">
          <h3>1. Research</h3>
          {research ? (
            <>
              <MethodBadge method={research.method} count={research.sources.length} />
              <p>{research.competitors.length} competitors found{research.key_numbers?.length ? `, ${research.key_numbers.length} key numbers` : ""}</p>
            </>
          ) : <p className="muted">Not started</p>}
        </Link>
        <Link to="validate" className="ov">
          <h3>2. Validate</h3>
          {validate ? (
            <>
              <span className={`badge badge--${validate.verdict}`}>{validate.verdict}</span>
              <p>Feasibility {validate.feasibility_score}/10</p>
            </>
          ) : <p className="muted">{research ? "Ready to run" : "Locked"}</p>}
        </Link>
        <Link to="plan" className="ov">
          <h3>3. Plan</h3>
          {plan ? <p>{plan.features.length} features suggested, {plan.viva_questions.length} viva questions</p> : <p className="muted">{validate ? "Ready to run" : "Locked"}</p>}
        </Link>
        <Link to="build" className="ov">
          <h3>4. Build</h3>
          {build ? (
            <>
              <p><strong>{build.config.app_name}</strong>, {TEMPLATE_INFO[build.template].title.toLowerCase()}</p>
              {build.checks && <p>{build.checks.passed}/{build.checks.total} checks passed</p>}
              {missionsTotal > 0 && <p>{missionsDone} of {missionsTotal} missions done</p>}
            </>
          ) : <p className="muted">{plan ? "Choose features and build" : "Locked"}</p>}
        </Link>
      </section>

      <section className="panel">
        {finished && !editing ? (
          <>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <h2>Finished</h2>
                {project.finished_at && <p className="muted">on {new Date(project.finished_at).toLocaleDateString()}</p>}
              </div>
              <div className="row">
                <button className="btn btn--ghost" onClick={() => setEditing(true)}>Edit links</button>
                <button className="btn btn--ghost" onClick={reopen} disabled={busy}>Reopen project</button>
              </div>
            </div>
            <div className="links">
              {project.github_url && <a href={project.github_url} target="_blank" rel="noreferrer">GitHub repository</a>}
              {project.live_url && <a href={project.live_url} target="_blank" rel="noreferrer">Live site</a>}
            </div>
            {project.notes && <p className="prose">{project.notes}</p>}
          </>
        ) : (
          <form className="finish" onSubmit={(e) => save(e)}>
            <div>
              <h2>{finished ? "Edit project links" : "Finish this project"}</h2>
              <p className="muted">Add where your project lives. Finished projects move to the Finished tab in your library.</p>
            </div>
            <div className="split">
              <label>
                GitHub repository
                <input type="url" value={github} onChange={(e) => setGithub(e.target.value)} placeholder="https://github.com/you/project" />
              </label>
              <label>
                Live site
                <input type="url" value={live} onChange={(e) => setLive(e.target.value)} placeholder="https://your-app.onrender.com" />
              </label>
            </div>
            <label>
              What you learned or would do next (optional)
              <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
            </label>
            {error && <p className="error" role="alert">{error}</p>}
            <div className="row">
              <button className="btn btn--build" disabled={busy}>{busy ? "Saving…" : finished ? "Save links" : "Mark as finished"}</button>
              {editing && <button type="button" className="btn btn--ghost" onClick={() => setEditing(false)}>Cancel</button>}
              {!build && !finished && <span className="muted">Tip: build the starter project first.</span>}
            </div>
          </form>
        )}
      </section>

      <div className="row">
        <button className="btn btn--danger" onClick={remove}>Delete project</button>
      </div>
    </div>
  );
}
