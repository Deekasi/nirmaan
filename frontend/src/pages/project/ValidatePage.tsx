import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { Progress } from "../../components";
import { useProject } from "./context";
import { Locked, StageHead } from "./Locked";

const STEPS = ["Comparing your idea with the research", "Writing an honest verdict"];

export default function ValidatePage() {
  const { project, results, refresh } = useProject();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const v = results.validate;

  if (!results.research) return <Locked need="Research" to="../research" />;

  async function run() {
    setBusy(true);
    setError("");
    try {
      await api.runStage(project.id, "validate");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const button = (
    <button className={v ? "btn btn--ghost" : "btn btn--build btn--big"} onClick={run} disabled={busy}>
      {busy ? "Checking…" : v ? "Run again" : "Validate my idea"}
    </button>
  );

  return (
    <section className="panel">
      <StageHead title="Validate the idea" intro="An honest check on who it's for, what makes it different, and whether to go ahead." action={v && button} />
      {busy && <Progress steps={STEPS} />}
      {error && <p className="error" role="alert">{error}</p>}
      {!v && !busy && button}
      {v && (
        <>
          <div className={`verdict verdict--${v.verdict}`}>
            <div>
              <div className="verdict__word">{v.verdict}</div>
              <div className="feasibility">
                <span>Feasibility {v.feasibility_score}/10</span>
                <div className="feasibility__bar" aria-hidden="true">
                  {Array.from({ length: 10 }, (_, i) => <span key={i} className={i < v.feasibility_score ? "on" : ""} />)}
                </div>
              </div>
            </div>
            <p className="prose">{v.verdict_reason}</p>
          </div>
          <dl className="facts">
            <dt>Target user</dt><dd>{v.target_user}</dd>
            <dt>Problem</dt><dd>{v.problem_statement}</dd>
            <dt>Your angle</dt><dd>{v.unique_angle}</dd>
            <dt>Risks</dt><dd><ul>{v.risks.map((x) => <li key={x}>{x}</li>)}</ul></dd>
          </dl>
          <Link to="../plan" relative="path" className="btn btn--build" style={{ justifySelf: "start" }}>Next: plan version one</Link>
        </>
      )}
    </section>
  );
}
