import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function Locked({ need, to }: { need: string; to: string }) {
  return (
    <section className="panel locked">
      <h2>Not unlocked yet</h2>
      <p className="muted">Finish {need} first, then come back here.</p>
      <Link to={to} className="btn btn--build" style={{ justifySelf: "start" }}>Go to {need}</Link>
    </section>
  );
}

export function StageHead({ title, intro, action }: { title: string; intro: string; action?: ReactNode }) {
  return (
    <header className="stage-head">
      <div>
        <h2>{title}</h2>
        <p className="muted">{intro}</p>
      </div>
      {action}
    </header>
  );
}
