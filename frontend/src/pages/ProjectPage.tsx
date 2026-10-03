import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type Plan, type Priority, type Project, type Results, type Template } from "../api";
import { StageRail } from "../StageRail";

type Busy = "research" | "validate" | "plan" | "build" | "download" | null;

const WAIT_TEXT: Record<Exclude<Busy, null>, string> = {
  research: "Searching the web and reading about your market. This can take 20–40 seconds…",
  validate: "Checking your idea against the research…",
  plan: "Writing your feature plan, stack and viva questions…",
  build: "Customizing your starter project…",
  download: "Preparing your zip…",
};

const PRIORITY_LABEL: Record<Priority, string> = { must: "Must have", nice: "Nice to have", later: "Later" };

const TEMPLATE_INFO: Record<Template, { title: string; body: string }> = {
  landing: { title: "Landing website", body: "A one-page site to explain your idea and collect sign-ups. No setup needed." },
  webapp: { title: "Web app", body: "Users can add and view saved items. Python backend + database." },
  chatbot: { title: "AI chatbot", body: "A chat assistant for your idea, powered by a free AI model." },
};

function Section(props: {
  n: number;
  title: string;
  intro: string;
  locked: boolean;
  done: boolean;
  children?: ReactNode;
}) {
  return (
    <section className={`stage ${props.locked ? "stage--locked" : ""}`}>
      <header className="stage__head">
        <span className={`stage__num ${props.done ? "stage__num--done" : ""}`} aria-hidden>
          {props.n}
        </span>
        <div>
          <h2>{props.title}</h2>
          <p className="muted">{props.locked ? "Finish the step above to unlock this." : props.intro}</p>
        </div>
      </header>
      {!props.locked && <div className="stage__body">{props.children}</div>}
    </section>
  );
}

export default function ProjectPage() {
  const { id } = useParams();
  const pid = Number(id);
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [results, setResults] = useState<Results>({});
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [template, setTemplate] = useState<Template>("webapp");

  function initChoices(plan: Plan, r: Results) {
    if (r.build) {
      setSelected(new Set(r.build.selected_features));
      setTemplate(r.build.template);
    } else {
      setSelected(new Set(plan.features.filter((f) => f.priority === "must").map((f) => f.name)));
      setTemplate(plan.recommended_template);
    }
  }

  useEffect(() => {
    Promise.all([api.getProject(pid), api.getResults(pid)])
      .then(([p, r]) => {
        setProject(p);
        setResults(r);
        if (r.plan) initChoices(r.plan, r);
      })
      .catch((e) => setError(e.message));
  }, [pid]);

  async function refresh() {
    const [p, r] = await Promise.all([api.getProject(pid), api.getResults(pid)]);
    setProject(p);
    setResults(r);
    return r;
  }

  async function run(stage: "research" | "validate" | "plan") {
    setBusy(stage);
    setError("");
    try {
      await api.runStage(pid, stage);
      const r = await refresh();
      if (stage === "plan" && r.plan) initChoices(r.plan, { ...r, build: undefined });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function build() {
    setBusy("build");
    setError("");
    try {
      await api.build(pid, [...selected], template);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function download() {
    setBusy("download");
    setError("");
    try {
      await api.download(pid);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!project || !confirm(`Delete "${project.name}"? This can't be undone.`)) return;
    await api.deleteProject(project.id);
    navigate("/");
  }

  function toggle(name: string) {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelected(next);
  }

  if (!project) {
    return error ? (
      <>
        <p className="error" role="alert">{error}</p>
        <Link to="/">Back to projects</Link>
      </>
    ) : (
      <p className="muted">Loading project…</p>
    );
  }

  const { research, validate, plan, build: built } = results;
  const runButton = (stage: "research" | "validate" | "plan", label: string, rerun: boolean) => (
    <button
      className={rerun ? "btn btn--ghost" : "btn btn--primary"}
      onClick={() => run(stage)}
      disabled={busy !== null}
    >
      {busy === stage ? "Working…" : rerun ? "Run again" : label}
    </button>
  );

  return (
    <article className="detail">
      <Link to="/" className="muted back">Back to projects</Link>
      <h1>{project.name}</h1>
      <StageRail stage={project.stage} large />

      <section className="panel">
        <h2>Your idea</h2>
        <p className="detail__idea">{project.idea}</p>
      </section>

      {busy && <p className="working" role="status">{WAIT_TEXT[busy]}</p>}
      {error && <p className="error panel" role="alert">{error}</p>}

      {/* 1. Research */}
      <Section n={1} title="Market research" intro="See who else is doing this, what users complain about, and whether the space is growing." locked={false} done={!!research}>
        {research ? (
          <>
            <p className="lead">{research.summary}</p>
            <p><strong>Trend:</strong> {research.market_trend}</p>
            <h3>Competitors</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Product</th><th>What they do</th><th>Weakness</th></tr></thead>
                <tbody>
                  {research.competitors.map((c) => (
                    <tr key={c.name}><td>{c.name}</td><td>{c.what_they_do}</td><td>{c.weakness}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="two-col">
              <div>
                <h3>What users complain about</h3>
                <ul>{research.user_complaints.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
              <div>
                <h3>Opportunities for you</h3>
                <ul>{research.opportunities.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            </div>
            {research.sources.length > 0 && (
              <>
                <h3>Sources</h3>
                <ul className="sources">
                  {research.sources.map((s) => (
                    <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>
                  ))}
                </ul>
              </>
            )}
            {runButton("research", "", true)}
          </>
        ) : (
          runButton("research", "Research the market", false)
        )}
      </Section>

      {/* 2. Validate */}
      <Section n={2} title="Validate the idea" intro="An honest check: who it's for, what makes it different, and whether to go ahead." locked={!research} done={!!validate}>
        {validate ? (
          <>
            <div className="verdict">
              <span className={`badge badge--${validate.verdict}`}>{validate.verdict}</span>
              <span>Feasibility <strong>{validate.feasibility_score}/10</strong></span>
            </div>
            <p className="lead">{validate.verdict_reason}</p>
            <dl className="facts">
              <dt>Target user</dt><dd>{validate.target_user}</dd>
              <dt>Problem</dt><dd>{validate.problem_statement}</dd>
              <dt>Your unique angle</dt><dd>{validate.unique_angle}</dd>
              <dt>Risks</dt><dd><ul>{validate.risks.map((x) => <li key={x}>{x}</li>)}</ul></dd>
            </dl>
            {runButton("validate", "", true)}
          </>
        ) : (
          runButton("validate", "Validate my idea", false)
        )}
      </Section>

      {/* 3. Plan */}
      <Section n={3} title="Plan your first version" intro="Pick the features for version 1 and the kind of starter project you want." locked={!validate} done={!!plan}>
        {plan ? (
          <>
            <h3>Features</h3>
            <p className="muted">Must-haves are ticked for you. Keep version 1 small.</p>
            {(["must", "nice", "later"] as Priority[]).map((p) => {
              const items = plan.features.filter((f) => f.priority === p);
              if (!items.length) return null;
              return (
                <fieldset key={p} className="features">
                  <legend>{PRIORITY_LABEL[p]}</legend>
                  {items.map((f) => (
                    <label key={f.name} className="check">
                      <input type="checkbox" checked={selected.has(f.name)} onChange={() => toggle(f.name)} />
                      <span><strong>{f.name}</strong> <span className="muted">{f.description}</span></span>
                    </label>
                  ))}
                </fieldset>
              );
            })}

            <h3>Starter project type</h3>
            <div className="templates" role="radiogroup">
              {(Object.keys(TEMPLATE_INFO) as Template[]).map((t) => (
                <label key={t} className={`template ${template === t ? "template--on" : ""}`}>
                  <input type="radio" name="template" checked={template === t} onChange={() => setTemplate(t)} />
                  <strong>
                    {TEMPLATE_INFO[t].title}
                    {plan.recommended_template === t && <span className="tag">Recommended</span>}
                  </strong>
                  <span className="muted">{TEMPLATE_INFO[t].body}</span>
                </label>
              ))}
            </div>
            <p className="muted">Why we recommend it: {plan.template_reason}</p>

            <h3>Tech stack</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Layer</th><th>Choice</th><th>Why</th></tr></thead>
                <tbody>
                  {plan.tech_stack.map((t) => (
                    <tr key={t.layer}><td>{t.layer}</td><td>{t.choice}</td><td>{t.why}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3>How it works, simply</h3>
            <p>{plan.beginner_explanation}</p>

            <h3>Defend your project</h3>
            <p className="muted">Questions an examiner or interviewer may ask. Click to see an answer.</p>
            <div className="viva">
              {plan.viva_questions.map((q) => (
                <details key={q.question}>
                  <summary>{q.question}</summary>
                  <p>{q.answer}</p>
                </details>
              ))}
            </div>

            <div className="row">
              <button className="btn btn--primary" onClick={build} disabled={busy !== null || selected.size === 0}>
                {busy === "build" ? "Building…" : built ? "Rebuild with these choices" : "Build my base project"}
              </button>
              {runButton("plan", "", true)}
            </div>
            {selected.size === 0 && <p className="muted">Pick at least one feature.</p>}
          </>
        ) : (
          runButton("plan", "Create my plan", false)
        )}
      </Section>

      {/* 4. Base project + download */}
      <Section n={4} title="Your base project" intro="A working starter project, customized for your idea, ready to download." locked={!built} done={!!built}>
        {built && (
          <>
            <div className="preview" style={{ ["--brand" as string]: built.config.primary_color }}>
              <div className="preview__hero">
                <strong>{built.config.app_name}</strong>
                <p>{built.config.tagline}</p>
              </div>
              <div className="preview__features">
                {built.config.features.map((f) => (
                  <div key={f.title}><strong>{f.title}</strong><p className="muted">{f.description}</p></div>
                ))}
              </div>
            </div>
            <p>
              Type: <strong>{TEMPLATE_INFO[built.template].title}</strong>. This is a working starter app with your
              name, colours and content. The features you picked are a <strong>checklist in the README</strong> for you
              to build on top of it, and <strong>NIRMAAN_REPORT.md</strong> has your research, plan and viva answers.
            </p>
            <button className="btn btn--primary btn--big" onClick={download} disabled={busy !== null}>
              {busy === "download" ? "Preparing…" : "Download project (.zip)"}
            </button>
          </>
        )}
      </Section>

      <div className="row danger-zone">
        <button className="btn btn--danger" onClick={remove}>Delete project</button>
      </div>
    </article>
  );
}
