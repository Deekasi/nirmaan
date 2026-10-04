import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, TOPICS, type Topic, type TrendReport } from "../api";
import { Cited, MethodBadge, Progress, Sources, timeAgo } from "../components";

export default function Explore() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState<Topic>("all");
  const [report, setReport] = useState<TrendReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load(t: Topic, refresh = false) {
    setBusy(true);
    setError("");
    try {
      setReport(await api.getTrends(t, refresh));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load(topic);
  }, [topic]);

  function start(idea: string, trend: string) {
    const params = new URLSearchParams({ name: idea.slice(0, 60), idea: `${idea}. (Inspired by the "${trend}" trend.)` });
    navigate(`/?${params}`);
  }

  return (
    <>
      <header className="band blueprint">
        <div className="band__inner">
          <h1>Explore what's growing</h1>
          <p className="lede">Trends from live web sources, with small project ideas you could build in a few weeks.</p>
          <div className="topics" role="tablist" aria-label="Topic">
            {TOPICS.map((t) => (
              <button key={t.key} role="tab" aria-selected={topic === t.key} className={`topic ${topic === t.key ? "topic--on" : ""}`} onClick={() => setTopic(t.key)} disabled={busy}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="page stack">
        {busy && <Progress steps={["Searching the web for recent trends", "Reading the sources", "Turning trends into project ideas"]} note="Results are saved for a day, so the next visit is instant." />}
        {error && <p className="error" role="alert">{error}</p>}
        {report && !busy && (
          <>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="row">
                <MethodBadge method={report.method} count={report.sources.length} />
                <span className="muted">Updated {timeAgo(report.updated_at)}</span>
              </div>
              <button className="btn btn--ghost" onClick={() => load(topic, true)}>Refresh</button>
            </div>
            <p className="lead"><Cited text={report.headline} sources={report.sources} /></p>
            <div className="trends">
              {report.trends.map((t) => (
                <article key={t.title} className="trend">
                  <header>
                    <h2>{t.title}</h2>
                    <span className={`chip chip--${t.difficulty}`}>{t.difficulty}</span>
                  </header>
                  <p className="prose"><Cited text={t.why_now} sources={report.sources} /></p>
                  <ul className="ideas">
                    {t.example_ideas.map((idea) => (
                      <li key={idea}>
                        <span>{idea}</span>
                        <button className="btn btn--ghost btn--small" onClick={() => start(idea, t.title)}>Start this</button>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <section className="panel"><Sources sources={report.sources} /></section>
          </>
        )}
      </main>
    </>
  );
}
