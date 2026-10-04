import { STAGES, type Stage } from "./api";

/** The project's progress through the five stages, drawn on the blueprint band. */
export function StageRail({ stage }: { stage: Stage }) {
  const current = STAGES.findIndex((s) => s.key === stage);
  return (
    <ol className="rail" style={{ gridTemplateColumns: `repeat(${STAGES.length}, 1fr)` }} aria-label={`Step ${current + 1} of ${STAGES.length}`}>
      {STAGES.map((s, i) => (
        <li key={s.key} className={i < current ? "done" : i === current ? "current" : ""} aria-current={i === current ? "step" : undefined}>
          <span className="rail__dot" />
          <span className="rail__label">{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

/** Compact 5-segment meter for project lists. */
export function StageMeter({ stage }: { stage: Stage }) {
  const done = stage === "download";
  const current = done ? STAGES.length : STAGES.findIndex((s) => s.key === stage);
  const label = done ? "Starter project ready" : `Next: ${STAGES[current].label}`;
  return (
    <div className="meter">
      <div className="meter__bar" aria-hidden="true">
        {STAGES.map((s, i) => <span key={s.key} className={i < current ? "on" : ""} />)}
      </div>
      <small>{label}</small>
    </div>
  );
}
