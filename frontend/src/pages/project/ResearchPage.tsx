import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { Cited, MethodBadge, Progress, Sources } from "../../components";
import { useProject } from "./context";
import { StageHead } from "./Locked";

const STEPS = ["Turning your idea into 6 search queries", "Searching the web", "Reading the pages", "Writing your research with citations"];

export default function ResearchPage() {
  const { project, results, refresh } = useProject();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const r = results.research;

  async function run() {
    setBusy(true);
    setError("");
    try {
      await api.runStage(project.id, "research");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const button = (
    <button className={r ? "btn btn--ghost" : "btn btn--build btn--big"} onClick={run} disabled={busy}>
      {busy ? "Researching…" : r ? "Run again" : "Research the market"}
    </button>
  );

  if (!r) {
    return (
      <section className="panel">
        <StageHead title="Market research" intro="Nirmaan searches the web for competitors, user complaints, market numbers, pricing and India-specific news, then writes a report with a source for every claim." />
        {busy ? <Progress steps={STEPS} note="This usually takes 30 to 90 seconds." /> : button}
        {error && <p className="error" role="alert">{error}</p>}
      </section>
    );
  }

  const src = r.sources;
  return (
    <div className="stack">
      <section className="panel">
        <StageHead title="Market research" intro="Click any [number] to open the page it came from." action={button} />
        {busy && <Progress steps={STEPS} note="This usually takes 30 to 90 seconds." />}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="row">
          <MethodBadge method={r.method} count={src.length} />
        </div>
        {r.note && <p className="muted">{r.note}</p>}
        {r.queries.length > 0 && (
          <div className="queries">
            <span className="muted">We searched for</span>
            {r.queries.map((q) => <span key={q} className="q">{q}</span>)}
          </div>
        )}
        <p className="lead"><Cited text={r.summary} sources={src} /></p>
      </section>

      {(r.key_numbers?.length ?? 0) > 0 && (
        <section className="numbers" aria-label="Key numbers">
          {r.key_numbers!.map((n) => (
            <div key={n.label} className="number">
              <strong>{n.value}</strong>
              <span>
                {n.label}
                {n.source && <Cited text={` [${n.source}]`} sources={src} />}
              </span>
            </div>
          ))}
        </section>
      )}

      <section className="panel">
        <div className="split">
          <div className="block">
            <h3>Market trend</h3>
            <p className="prose"><Cited text={r.market_trend} sources={src} /></p>
          </div>
          {r.market_size && (
            <div className="block">
              <h3>Market size</h3>
              <p className="prose"><Cited text={r.market_size} sources={src} /></p>
            </div>
          )}
        </div>
        {(r.target_segments?.length ?? 0) > 0 && (
          <div className="block">
            <h3>Who would use it</h3>
            <div className="chips">{r.target_segments!.map((t) => <span key={t} className="chip">{t}</span>)}</div>
          </div>
        )}
      </section>

      <section className="panel">
        <h3>Who already does this</h3>
        <div className="table-wrap">
          <table className="compare">
            <thead><tr><th>Product</th><th>What they do</th><th>Pricing</th><th>Gap you can use</th></tr></thead>
            <tbody>
              {r.competitors.map((c) => (
                <tr key={c.name}>
                  <td><strong>{c.name}</strong></td>
                  <td><Cited text={c.what_they_do} sources={src} /></td>
                  <td><Cited text={c.pricing ?? "Not found in sources"} sources={src} /></td>
                  <td className="gap"><Cited text={c.weakness} sources={src} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="split">
          <div className="block">
            <h3>What users complain about</h3>
            <ul className="points points--pain">
              {r.user_complaints.map((x) => <li key={x}><span><Cited text={x} sources={src} /></span></li>)}
            </ul>
          </div>
          <div className="block">
            <h3>Openings for you</h3>
            <ul className="points points--gain">
              {r.opportunities.map((x) => <li key={x}><span><Cited text={x} sources={src} /></span></li>)}
            </ul>
          </div>
        </div>
        {r.india_angle && (
          <div className="block callout">
            <h3>India angle</h3>
            <p className="prose"><Cited text={r.india_angle} sources={src} /></p>
          </div>
        )}
      </section>

      {r.swot && (
        <section className="panel">
          <h3>SWOT for your idea</h3>
          <div className="swot">
            {([
              ["Strengths", r.swot.strengths, "s"],
              ["Weaknesses", r.swot.weaknesses, "w"],
              ["Opportunities", r.swot.opportunities, "o"],
              ["Threats", r.swot.threats, "t"],
            ] as [string, string[], string][]).map(([label, items, k]) => (
              <div key={label} className={`swot__cell swot__cell--${k}`}>
                <h4>{label}</h4>
                <ul>{items.map((x) => <li key={x}><Cited text={x} sources={src} /></li>)}</ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <Sources sources={src} />
        <Link to="../validate" relative="path" className="btn btn--build" style={{ justifySelf: "start" }}>Next: validate the idea</Link>
      </section>
    </div>
  );
}
