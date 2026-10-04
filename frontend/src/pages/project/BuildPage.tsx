import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api, type Checks, type Template } from "../../api";
import { useProject } from "./context";
import { Locked, StageHead } from "./Locked";
import { TEMPLATE_INFO } from "./PlanPage";

const STATUS_ICON = { pass: "✓", warn: "!", fail: "✕", skip: "–" } as const;
const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** The quality checks, revealed one by one like a CI run (with the real timings from the server). */
function Pipeline({ checks, animate, onDone }: { checks: Checks; animate: boolean; onDone: () => void }) {
  const total = checks.steps.length;
  const [shown, setShown] = useState(animate ? 0 : total);

  useEffect(() => {
    if (!animate) return setShown(total);
    setShown(0);
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= total) clearInterval(t);
    }, 420);
    return () => clearInterval(t);
  }, [animate, total, checks]);

  useEffect(() => {
    if (shown >= total) onDone();
  }, [shown, total, onDone]);

  const done = shown >= total;
  const totalMs = checks.steps.reduce((a, s) => a + s.ms, 0);
  return (
    <div className="pipeline">
      <ol className="pipeline__steps">
        {checks.steps.map((s, i) => {
          const state = i < shown ? s.status : i === shown ? "running" : "queued";
          return (
            <li key={s.name} className={`pstep pstep--${state}`}>
              <span className="pstep__icon" aria-hidden="true">{state in STATUS_ICON ? STATUS_ICON[state as keyof typeof STATUS_ICON] : ""}</span>
              <span className="pstep__name">{s.name}</span>
              <span className="pstep__detail">{i < shown ? s.detail : state === "running" ? "Running…" : ""}</span>
              <span className="pstep__ms">{i < shown ? `${s.ms.toFixed(1)} ms` : ""}</span>
            </li>
          );
        })}
      </ol>
      <div className={`gate ${done ? (checks.ship_ready ? "gate--ok" : "gate--fail") : ""}`} aria-live="polite">
        {done ? (
          <>
            <strong>{checks.ship_ready ? "Ship-ready" : "Needs fixes"}</strong>
            <span>{checks.passed} of {checks.total} checks passed in {totalMs.toFixed(1)} ms</span>
          </>
        ) : (
          <span>Running {total} checks on your generated project…</span>
        )}
      </div>
    </div>
  );
}

const ARCH: Record<Template, { nodes: { x: number; label: string; sub: string }[]; note: string }> = {
  landing: {
    nodes: [
      { x: 30, label: "Browser", sub: "Visitor" },
      { x: 250, label: "index.html", sub: "Content" },
      { x: 470, label: "style.css", sub: "Brand colours" },
    ],
    note: "A static site: no server needed, so it loads instantly and hosts for free.",
  },
  webapp: {
    nodes: [
      { x: 30, label: "Browser", sub: "static/index.html" },
      { x: 250, label: "FastAPI", sub: "main.py, REST API" },
      { x: 470, label: "SQLite", sub: "app.db" },
    ],
    note: "The page calls a REST API with fetch(); the API validates input and saves rows in SQLite.",
  },
  chatbot: {
    nodes: [
      { x: 30, label: "Browser", sub: "Chat page" },
      { x: 250, label: "FastAPI", sub: "main.py, /api/chat" },
      { x: 470, label: "Groq API", sub: "LLM, key stays on server" },
    ],
    note: "The browser never sees the API key: the server adds it and forwards the conversation to the model.",
  },
};

/** Architecture drawn on blueprint paper; the connectors draw themselves when the build finishes. */
function Blueprint({ template, draw }: { template: Template; draw: boolean }) {
  const a = ARCH[template];
  return (
    <figure className="arch blueprint">
      <svg viewBox="0 0 660 150" role="img" aria-label={`Architecture: ${a.nodes.map((n) => n.label).join(" to ")}`}>
        {a.nodes.slice(0, -1).map((n, i) => (
          <g key={`l${i}`} className={draw ? "arch__link arch__link--draw" : "arch__link"} style={{ animationDelay: `${i * 0.5}s` }}>
            <line x1={n.x + 160} y1={66} x2={a.nodes[i + 1].x} y2={66} />
            <line x1={a.nodes[i + 1].x} y1={84} x2={n.x + 160} y2={84} />
            <polygon points={`${a.nodes[i + 1].x},66 ${a.nodes[i + 1].x - 8},61 ${a.nodes[i + 1].x - 8},71`} />
            <polygon points={`${n.x + 160},84 ${n.x + 168},79 ${n.x + 168},89`} />
          </g>
        ))}
        {a.nodes.map((n) => (
          <g key={n.label} className="arch__node">
            <rect x={n.x} y={35} width={160} height={80} rx={6} />
            <text x={n.x + 80} y={70} textAnchor="middle" className="arch__label">{n.label}</text>
            <text x={n.x + 80} y={92} textAnchor="middle" className="arch__sub">{n.sub}</text>
          </g>
        ))}
      </svg>
      <figcaption>{a.note}</figcaption>
    </figure>
  );
}

export default function BuildPage() {
  const { project, results, refresh } = useProject();
  const location = useLocation();
  const justBuilt = Boolean((location.state as { justBuilt?: boolean } | null)?.justBuilt) && !reducedMotion();
  const [animate, setAnimate] = useState(justBuilt);
  const [revealed, setRevealed] = useState(!justBuilt);
  const [done, setDone] = useState<string[]>(results.build?.missions_done ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const b = results.build;

  useEffect(() => setDone(b?.missions_done ?? []), [b]);

  if (!b) {
    return results.plan ? <Locked need="Plan" to="../plan" /> : <Locked need="Validate" to="../validate" />;
  }

  async function toggleMission(id: string) {
    const next = done.includes(id) ? done.filter((d) => d !== id) : [...done, id];
    setDone(next); // optimistic: update now, save in the background
    try {
      await api.updateMissions(project.id, next);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
      setDone(done);
    }
  }

  async function download() {
    setBusy(true);
    setError("");
    try {
      await api.download(project.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const missions = b.missions ?? [];
  const pct = missions.length ? Math.round((done.length / missions.length) * 100) : 0;
  const checks = b.checks;

  return (
    <div className="stack">
      <section className="panel">
        <StageHead
          title={`${b.config.app_name}: build report`}
          intro={`${TEMPLATE_INFO[b.template].title} generated from tested templates, then checked like a real release.`}
          action={checks && <button className="btn btn--ghost" onClick={() => { setRevealed(false); setAnimate(false); requestAnimationFrame(() => setAnimate(true)); }}>Replay checks</button>}
        />
        {checks ? (
          <Pipeline checks={checks} animate={animate} onDone={() => setRevealed(true)} />
        ) : (
          <p className="muted">This project was built before quality checks existed. Rebuild it from the Plan page to run them.</p>
        )}
      </section>

      {revealed && (
        <>
          <section className="panel">
            <h3>Architecture</h3>
            <Blueprint template={b.template} draw={animate} />
          </section>

          <section className="panel">
            <div className="split">
              <div className="block">
                <h3>Preview</h3>
                <div className="browser" style={{ ["--brand" as string]: b.config.primary_color }}>
                  <div className="browser__bar">
                    <span className="browser__dots"><i /><i /><i /></span>
                    <span className="browser__url">{b.config.app_name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.onrender.com</span>
                  </div>
                  <div className="browser__hero">
                    <strong>{b.config.app_name}</strong>
                    <p>{b.config.tagline}</p>
                  </div>
                  <div className="browser__features">
                    {b.config.features.slice(0, 4).map((f) => <div key={f.title}><strong>{f.title}</strong><p>{f.description}</p></div>)}
                  </div>
                </div>
              </div>
              {checks && (
                <div className="block">
                  <h3>Files</h3>
                  <table className="files">
                    <thead><tr><th>File</th><th>Lines</th></tr></thead>
                    <tbody>
                      {checks.files.map((f) => <tr key={f.path}><td><code>{f.path}</code></td><td>{f.lines}</td></tr>)}
                    </tbody>
                    <tfoot><tr><td>{checks.files.length} files</td><td>{checks.total_lines}</td></tr></tfoot>
                  </table>
                  <div className="langbar" aria-label="Lines by language">
                    {Object.entries(checks.lines_by_language).sort((x, y) => y[1] - x[1]).map(([lang, n]) => (
                      <span key={lang} style={{ flexGrow: n }} title={`${lang}: ${n} lines`} className={`lang lang--${lang.toLowerCase()}`} />
                    ))}
                  </div>
                  <p className="muted small">
                    {Object.entries(checks.lines_by_language).sort((x, y) => y[1] - x[1]).map(([lang, n]) => `${lang} ${n}`).join(", ")}
                  </p>
                </div>
              )}
            </div>
            <div className="row">
              <button className="btn btn--build btn--big" onClick={download} disabled={busy}>{busy ? "Preparing…" : "Download project (.zip)"}</button>
              <span className="muted">Includes README, feature checklist and NIRMAAN_REPORT.md</span>
            </div>
            {error && <p className="error" role="alert">{error}</p>}
          </section>

          {missions.length > 0 && (
            <section className="panel">
              <StageHead title="Missions" intro="Real engineering tasks that turn the starter into your project. Tick them off as you go." />
              <div className="mission-progress">
                <div className="mission-progress__bar"><span style={{ width: `${pct}%` }} /></div>
                <span>{done.length} of {missions.length} done</span>
              </div>
              <ul className="missions">
                {missions.map((m) => {
                  const on = done.includes(m.id);
                  return (
                    <li key={m.id}>
                      <label className={`pick ${on ? "pick--on" : ""}`}>
                        <input type="checkbox" checked={on} onChange={() => toggleMission(m.id)} />
                        <span className="pick__box" aria-hidden="true" />
                        <span>
                          <strong>{m.title}</strong>
                          {m.detail && <span className="muted">{m.detail}</span>}
                          <span className="chips">
                            <span className={`chip chip--${m.difficulty}`}>{m.difficulty}</span>
                            {m.skills.map((s) => <span key={s} className="chip">{s}</span>)}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {pct === 100 && project.status !== "finished" && (
                <p className="callout">All missions done. <Link to="..">Mark the project as finished</Link> and add your GitHub and live links.</p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
