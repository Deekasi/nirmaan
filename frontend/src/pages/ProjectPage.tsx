import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, STAGES, type Project } from "../api";
import { StageRail } from "../StageRail";

export default function ProjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getProject(Number(id)).then(setProject).catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <>
        <p className="error" role="alert">{error}</p>
        <Link to="/">Back to projects</Link>
      </>
    );
  }
  if (!project) return <p className="muted">Loading project…</p>;

  const index = STAGES.findIndex((s) => s.key === project.stage);
  const next = STAGES[index + 1];

  async function advance() {
    if (!next || !project) return;
    setProject(await api.updateProject(project.id, { stage: next.key }));
  }

  async function remove() {
    if (!project || !confirm(`Delete "${project.name}"? This can't be undone.`)) return;
    await api.deleteProject(project.id);
    navigate("/");
  }

  return (
    <article className="detail">
      <Link to="/" className="muted back">Back to projects</Link>
      <h1>{project.name}</h1>
      <StageRail stage={project.stage} large />

      <section className="panel">
        <h2>The idea</h2>
        <p className="detail__idea">{project.idea}</p>
      </section>

      <section className="panel panel--quiet">
        <h2>Next: {next ? next.label : "All steps done"}</h2>
        <p className="muted">
          In Phase 2, the AI planner will generate this step for you. For now, you can move the project forward
          manually to test the flow.
        </p>
        <div className="row">
          {next && (
            <button className="btn btn--primary" onClick={advance}>
              Mark {STAGES[index].label} as done
            </button>
          )}
          <button className="btn btn--danger" onClick={remove}>
            Delete project
          </button>
        </div>
      </section>
    </article>
  );
}
