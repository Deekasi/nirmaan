import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  api,
  type Plan,
  type Priority,
  type Project,
  type ResearchMethod,
  type Results,
  type Source,
  type Template,
} from "../api";
import { StageRail } from "../StageRail";

type StageKey = "research" | "validate" | "plan" | "build";
type Busy = StageKey | "download" | null;

const STEPS: Record<StageKey, string[]> = {
  research: ["Turning your idea into search queries", "Searching the web", "Reading the sources", "Writing your research with citations"],
  validate: ["Comparing your idea with the research", "Writing an honest verdict"],
  plan: ["Choosing features for version one", "Picking a beginner-friendly stack", "Preparing viva questions"],
  build: ["Customizing your starter project"],
};

const METHOD_LABEL: Record<ResearchMethod, string> = {
  web_search: "Live web research",
  ai_search: "AI web search",
  ai_knowledge: "AI knowledge only, no live sources",
  demo: "Demo data",
};

const PRIORITY_LABEL: Record<Priority, string> = { must: "Must have", nice: "Nice to have", later: "Later" };

const TEMPLATE_INFO: Record<Template, { title: string; body: string; icon: ReactNode }> = {
  landing: {
    title: "Landing website",
    body: "One page that explains your idea and collects sign-ups. Opens with a double-click.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="26" height="22" rx="3" /><path d="M3 11h26M8 17h12M8 21h8" /></svg>
    ),
  },
  webapp: {
    title: "Web app",
    body: "People add and see saved items. Python backend with a database.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="26" height="22" rx="3" /><path d="M3 11h26M9 16h14M9 20h14M9 24h9" /><circle cx="25" cy="22" r="0.5" /></svg>
    ),
  },
  chatbot: {
    title: "AI chatbot",
    body: "A chat assistant for your idea, powered by a free AI model.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 7h22v14H14l-6 5v-5H5z" strokeLinejoin="round" /><path d="M11 14h.01M16 14h.01M21 14h.01" strokeLinecap="round" strokeWidth="3" /></svg>
    ),
  },
};

/** Renders text with [n] citations as small links to the numbered sources. */
function Cited({ text, sources }: { text: string; sources: Source[] }) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = /^\[(\d+)\]$/.exec(part);
        const src = m ? sources.find((s) => s.id === Number(m[1])) : undefined;
        if (!m) return <span key={i}>{part}</span>;
        if (!src) return null; // drop citations that don't match a real source
        return (
          <sup key={i} className="cite">
            <a href={src.url} target="_blank" rel="noreferrer" title={src.title}>[{src.id}]</a>
          </sup>
        );
      })}
    </>
  );
}

function Progress({ stage }: { stage: StageKey }) {
  const steps = STEPS[stage];
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive((a) => Math.min(a + 1, steps.length - 1)), 7000);
    return () => clearInterval(t);
  }, [steps.length]);
  return (
    <div className="progress" role="status" aria-live="polite">
      <ol>
        {steps.map((s, i) => (
          <li key={s} className={i < active ? "done" : i === active ? "active" : ""}>{s}</li>
        ))}
      </ol>
      {stage === "research" && <p className="muted">This usually takes 20 to 60 seconds.</p>}
    </div>
  );
}

function Stage(props: {
  id: StageKey;
  n: number;
  title: string;
  intro: string;
  locked: boolean;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section id={props.id} className={`stage ${props.locked ? "stage--locked" : ""}`} aria-labelledby={`${props.id}-title`}>
      <header className="stage__head">
        <div>
          <h2 id={`${props.id}-title`}>{props.n}. {props.title}</h2>
          <p className="muted">{props.locked ? "Finish the step before this one to unlock it." : props.intro}</p>
        </div>
        {!props.locked && props.action}
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
  const [error, setError] = useState<{ stage: Busy; message: string } | null>(null);
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
      .catch((e) => setError({ stage: null, message: e.message }));
  }, [pid]);

  async function refresh() {
    const [p, r] = await Promise.all([api.getProject(pid), api.getResults(pid)]);
    setProject(p);
    setResults(r);
    return r;
  }

  async function act(stage: Exclude<Busy, null>, fn: () => Promise<unknown>, after?: (r: Results) => void) {
    setBusy(stage);
    setError(null);
    try {
      await fn();
      if (stage !== "download") {
        const r = await refresh();
        after?.(r);
      }
    } catch (e) {
      setError({ stage, message: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const run = (stage: "research" | "validate" | "plan") =>
    act(stage, () => api.runStage(pid, stage), (r) => {
      if (stage === "plan" && r.plan) initChoices(r.plan, { ...r, build: undefined });
    });

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
    return (
      <main className="page">
        {error ? (
          <>
            <p className="error" role="alert">{error.message}</p>
            <p style={{ marginTop: "1rem" }}><Link to="/">Back to projects</Link></p>
          </>
        ) : (
          <p className="muted">Loading project…</p>
        )}
      </main>
    );
  }

  const { research, validate, plan, build: built } = results;
  const doneFlags: Record<StageKey, boolean> = { research: !!research, validate: !!validate, plan: !!plan, build: !!built };
  const nextStage = (["research", "validate", "plan", "build"] as StageKey[]).find((s) => !doneFlags[s]);

  const runButton = (stage: "research" | "validate" | "plan", label: string, done: boolean) => (
    <button className={done ? "btn btn--ghost" : "btn btn--build btn--big"} onClick={() => run(stage)} disabled={busy !== null}>
      {busy === stage ? "Working…" : done ? "Run again" : label}
    </button>
  );
  const stageError = (stage: Busy) =>
    error?.stage === stage ? <p className="error" role="alert">{error.message}</p> : null;
  const sources = research?.sources ?? [];

  return (
    <>
      <header className="band blueprint">
        <div className="band__inner">
          <Link to="/" className="back">Back to projects</Link>
          <h1>{project.name}</h1>
          <p className="lede">{project.idea}</p>
          <StageRail stage={project.stage} />
        </div>
      </header>

      <main className="page">
        <div className="workspace">
          <nav className="journey" aria-label="Project stages">
            {([
              ["research", "Research"],
              ["validate", "Validate"],
              ["plan", "Plan"],
              ["build", "Build"],
            ] as [StageKey, string][]).map(([key, label], i) => (
              <a key={key} href={`#${key}`} className={doneFlags[key] ? "is-done" : key === nextStage ? "is-next" : ""}>
                <span className="journey__num">{i + 1}</span>
                {label}
              </a>
            ))}
            <button className="btn btn--danger journey__delete" onClick={remove}>Delete project</button>
          </nav>

          <div className="stages">
            {/* 1. Research */}
            <Stage
              id="research" n={1} title="Market research" locked={false}
              intro="Who already does this, what their users complain about, and where the gaps are."
              action={research && runButton("research", "", true)}
            >
              {busy === "research" ? <Progress stage="research" /> : stageError("research")}
              {research ? (
                <>
                  <div className="row">
                    <span className={`method method--${research.method}`}>
                      {METHOD_LABEL[research.method]}
                      {sources.length > 0 && ` from ${sources.length} sources`}
                    </span>
                  </div>
                  {research.note && <p className="muted">{research.note}</p>}
                  {research.queries.length > 0 && (
                    <div className="queries">
                      <span className="muted">We searched for</span>
                      {research.queries.map((q) => <span key={q} className="q">{q}</span>)}
                    </div>
                  )}
                  <p className="lead"><Cited text={research.summary} sources={sources} /></p>
                  <p className="prose"><strong>Trend.</strong> <Cited text={research.market_trend} sources={sources} /></p>

                  <div className="block">
                    <h3>Who already does this</h3>
                    <div className="competitors">
                      {research.competitors.map((c) => (
                        <div key={c.name} className="competitor">
                          <strong>{c.name}</strong>
                          <span><Cited text={c.what_they_do} sources={sources} /></span>
                          <span className="competitor__gap"><Cited text={c.weakness} sources={sources} /></span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="split">
                    <div className="block">
                      <h3>What users complain about</h3>
                      <ul className="points points--pain">
                        {research.user_complaints.map((x) => <li key={x}><span><Cited text={x} sources={sources} /></span></li>)}
                      </ul>
                    </div>
                    <div className="block">
                      <h3>Openings for you</h3>
                      <ul className="points points--gain">
                        {research.opportunities.map((x) => <li key={x}><span><Cited text={x} sources={sources} /></span></li>)}
                      </ul>
                    </div>
                  </div>

                  {sources.length > 0 && (
                    <div className="block">
                      <h3>Sources</h3>
                      <ol className="sources">
                        {sources.map((s) => (
                          <li key={s.id} id={`source-${s.id}`}>
                            <b>[{s.id}]</b>
                            <span>
                              <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> <small>{s.domain}</small>
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </>
              ) : (
                busy !== "research" && runButton("research", "Research the market", false)
              )}
            </Stage>

            {/* 2. Validate */}
            <Stage
              id="validate" n={2} title="Validate the idea" locked={!research}
              intro="An honest check on who it's for, what makes it different, and whether to go ahead."
              action={validate && runButton("validate", "", true)}
            >
              {busy === "validate" ? <Progress stage="validate" /> : stageError("validate")}
              {validate ? (
                <>
                  <div className={`verdict verdict--${validate.verdict}`}>
                    <div>
                      <div className="verdict__word">{validate.verdict}</div>
                      <div className="feasibility">
                        <span>Feasibility {validate.feasibility_score}/10</span>
                        <div className="feasibility__bar" aria-hidden="true">
                          {Array.from({ length: 10 }, (_, i) => <span key={i} className={i < validate.feasibility_score ? "on" : ""} />)}
                        </div>
                      </div>
                    </div>
                    <p className="prose">{validate.verdict_reason}</p>
                  </div>
                  <dl className="facts">
                    <dt>Target user</dt><dd>{validate.target_user}</dd>
                    <dt>Problem</dt><dd>{validate.problem_statement}</dd>
                    <dt>Your angle</dt><dd>{validate.unique_angle}</dd>
                    <dt>Risks</dt><dd><ul>{validate.risks.map((x) => <li key={x}>{x}</li>)}</ul></dd>
                  </dl>
                </>
              ) : (
                busy !== "validate" && runButton("validate", "Validate my idea", false)
              )}
            </Stage>

            {/* 3. Plan */}
            <Stage
              id="plan" n={3} title="Plan version one" locked={!validate}
              intro="Choose what goes into the first version and the kind of starter project you want."
              action={plan && runButton("plan", "", true)}
            >
              {busy === "plan" ? <Progress stage="plan" /> : stageError("plan")}
              {plan ? (
                <>
                  <div className="picker">
                    <h3>Features</h3>
                    <p className="muted">Must-haves are selected for you. A small first version is easier to finish.</p>
                    {(["must", "nice", "later"] as Priority[]).map((p) => {
                      const items = plan.features.filter((f) => f.priority === p);
                      if (!items.length) return null;
                      return (
                        <div key={p} className="picker">
                          <div className="picker__group">{PRIORITY_LABEL[p]}</div>
                          {items.map((f) => {
                            const on = selected.has(f.name);
                            return (
                              <label key={f.name} className={`pick ${on ? "pick--on" : ""}`}>
                                <input type="checkbox" checked={on} onChange={() => toggle(f.name)} />
                                <span className="pick__box" aria-hidden="true" />
                                <span><strong>{f.name}</strong> <span className="muted">{f.description}</span></span>
                              </label>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>

                  <div className="block">
                    <h3>Starter project</h3>
                    <div className="templates" role="radiogroup" aria-label="Starter project type">
                      {(Object.keys(TEMPLATE_INFO) as Template[]).map((t) => (
                        <label key={t} className={`template ${template === t ? "template--on" : ""}`}>
                          <input type="radio" name="template" checked={template === t} onChange={() => setTemplate(t)} />
                          {TEMPLATE_INFO[t].icon}
                          <strong>
                            {TEMPLATE_INFO[t].title}
                            {plan.recommended_template === t && <span className="tag">Recommended</span>}
                          </strong>
                          <span className="muted">{TEMPLATE_INFO[t].body}</span>
                        </label>
                      ))}
                    </div>
                    <p className="muted">{plan.template_reason}</p>
                  </div>

                  <div className="block">
                    <h3>Tech stack</h3>
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>Part</th><th>Choice</th><th>Why</th></tr></thead>
                        <tbody>
                          {plan.tech_stack.map((t) => <tr key={t.layer}><td>{t.layer}</td><td>{t.choice}</td><td>{t.why}</td></tr>)}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="block">
                    <h3>How it works, simply</h3>
                    <p className="prose">{plan.beginner_explanation}</p>
                  </div>

                  <div className="block">
                    <h3>Defend your project</h3>
                    <p className="muted">Questions an examiner or interviewer may ask. Open one to see a model answer.</p>
                    <div className="viva">
                      {plan.viva_questions.map((q) => (
                        <details key={q.question}>
                          <summary>{q.question}</summary>
                          <p className="prose">{q.answer}</p>
                        </details>
                      ))}
                    </div>
                  </div>

                  <div className="buildbar">
                    <button className="btn btn--build btn--big" onClick={() => act("build", () => api.build(pid, [...selected], template))} disabled={busy !== null || selected.size === 0}>
                      {busy === "build" ? "Building…" : built ? "Rebuild with these choices" : "Build my starter project"}
                    </button>
                    <span className="muted">{selected.size === 0 ? "Pick at least one feature." : `${selected.size} feature${selected.size === 1 ? "" : "s"} selected`}</span>
                  </div>
                  {busy === "build" ? <Progress stage="build" /> : stageError("build")}
                </>
              ) : (
                busy !== "plan" && runButton("plan", "Create my plan", false)
              )}
            </Stage>

            {/* 4. Build */}
            <Stage
              id="build" n={4} title="Your starter project" locked={!built}
              intro="A working base app with your name, colours and content, ready to download."
            >
              {built && (
                <>
                  <div className="browser" style={{ ["--brand" as string]: built.config.primary_color }}>
                    <div className="browser__bar">
                      <span className="browser__dots"><i /><i /><i /></span>
                      <span className="browser__url">{built.config.app_name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.onrender.com</span>
                    </div>
                    <div className="browser__hero">
                      <strong>{built.config.app_name}</strong>
                      <p>{built.config.tagline}</p>
                    </div>
                    <div className="browser__features">
                      {built.config.features.map((f) => (
                        <div key={f.title}><strong>{f.title}</strong><p>{f.description}</p></div>
                      ))}
                    </div>
                  </div>
                  <p className="prose">
                    <strong>{TEMPLATE_INFO[built.template].title}.</strong> The zip has the working base app, a README that
                    walks you through running it, putting it on GitHub and going live, a checklist of the features you
                    picked, and <strong>NIRMAAN_REPORT.md</strong> with your research, plan and viva answers.
                  </p>
                  <div className="row">
                    <button className="btn btn--build btn--big" onClick={() => act("download", () => api.download(pid))} disabled={busy !== null}>
                      {busy === "download" ? "Preparing…" : "Download project (.zip)"}
                    </button>
                  </div>
                  {stageError("download")}
                </>
              )}
            </Stage>
          </div>
        </div>
      </main>
    </>
  );
}
