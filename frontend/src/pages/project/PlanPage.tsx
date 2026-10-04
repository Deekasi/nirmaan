import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Priority, type Template } from "../../api";
import { Progress } from "../../components";
import { useProject } from "./context";
import { Locked, StageHead } from "./Locked";

const PRIORITY_LABEL: Record<Priority, string> = { must: "Must have", nice: "Nice to have", later: "Later" };

export const TEMPLATE_INFO: Record<Template, { title: string; body: string; icon: ReactNode }> = {
  landing: {
    title: "Landing website",
    body: "One page that explains your idea and collects sign-ups. Opens with a double-click.",
    icon: <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="26" height="22" rx="3" /><path d="M3 11h26M8 17h12M8 21h8" /></svg>,
  },
  webapp: {
    title: "Web app",
    body: "People add and see saved items. Python backend with a database.",
    icon: <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="26" height="22" rx="3" /><path d="M3 11h26M9 16h14M9 20h14M9 24h9" /></svg>,
  },
  chatbot: {
    title: "AI chatbot",
    body: "A chat assistant for your idea, powered by a free AI model.",
    icon: <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 7h22v14H14l-6 5v-5H5z" strokeLinejoin="round" /><path d="M11 14h.01M16 14h.01M21 14h.01" strokeLinecap="round" strokeWidth="3" /></svg>,
  },
};

export default function PlanPage() {
  const { project, results, refresh } = useProject();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<"plan" | "build" | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [template, setTemplate] = useState<Template>("webapp");
  const plan = results.plan;
  const built = results.build;

  useEffect(() => {
    if (!plan) return;
    if (built) {
      setSelected(new Set(built.selected_features));
      setTemplate(built.template);
    } else {
      setSelected(new Set(plan.features.filter((f) => f.priority === "must").map((f) => f.name)));
      setTemplate(plan.recommended_template);
    }
  }, [plan, built]);

  if (!results.validate) return <Locked need="Validate" to="../validate" />;

  async function runPlan() {
    setBusy("plan");
    setError("");
    try {
      await api.runStage(project.id, "plan");
      await refresh();
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
      await api.build(project.id, [...selected], template);
      await refresh();
      navigate("../build", { relative: "path", state: { justBuilt: true } });
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  function toggle(name: string) {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelected(next);
  }

  if (!plan) {
    return (
      <section className="panel">
        <StageHead title="Plan version one" intro="Nirmaan suggests features, a beginner-friendly stack and the questions you'll be asked about your project." />
        {busy === "plan" ? <Progress steps={["Choosing features for version one", "Picking a stack", "Preparing viva questions"]} /> : (
          <button className="btn btn--build btn--big" onClick={runPlan} disabled={busy !== null} style={{ justifySelf: "start" }}>Create my plan</button>
        )}
        {error && <p className="error" role="alert">{error}</p>}
      </section>
    );
  }

  return (
    <div className="stack">
      <section className="panel">
        <StageHead
          title="Plan version one"
          intro="Choose what goes into the first version. A small first version is easier to finish."
          action={<button className="btn btn--ghost" onClick={runPlan} disabled={busy !== null}>{busy === "plan" ? "Planning…" : "Run again"}</button>}
        />
        {busy === "plan" && <Progress steps={["Choosing features for version one", "Picking a stack", "Preparing viva questions"]} />}
        <div className="picker">
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
      </section>

      <section className="panel">
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
        <div className="table-wrap">
          <table>
            <thead><tr><th>Part</th><th>Choice</th><th>Why</th></tr></thead>
            <tbody>{plan.tech_stack.map((t) => <tr key={t.layer}><td>{t.layer}</td><td>{t.choice}</td><td>{t.why}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="block">
          <h3>How it works, simply</h3>
          <p className="prose">{plan.beginner_explanation}</p>
        </div>
      </section>

      <section className="panel">
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
      </section>

      <section className="panel buildpanel">
        {busy === "build" && <Progress steps={["Customizing your starter project", "Running quality checks"]} />}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="row">
          <button className="btn btn--build btn--big" onClick={build} disabled={busy !== null || selected.size === 0}>
            {busy === "build" ? "Building…" : built ? "Rebuild with these choices" : "Build my starter project"}
          </button>
          <span className="muted">{selected.size === 0 ? "Pick at least one feature." : `${selected.size} feature${selected.size === 1 ? "" : "s"} and a ${TEMPLATE_INFO[template].title.toLowerCase()}`}</span>
        </div>
      </section>
    </div>
  );
}
