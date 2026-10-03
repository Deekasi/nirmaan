import { STAGES, type Stage } from "./api";

/** Shows how far a project has moved through the six Nirmaan steps. */
export function StageRail({ stage, large = false }: { stage: Stage; large?: boolean }) {
  const current = STAGES.findIndex((s) => s.key === stage);
  return (
    <ol className={`rail ${large ? "rail--large" : ""}`} aria-label={`Step ${current + 1} of ${STAGES.length}`}>
      {STAGES.map((s, i) => (
        <li
          key={s.key}
          className={i < current ? "done" : i === current ? "current" : ""}
          aria-current={i === current ? "step" : undefined}
        >
          <span className="rail__dot" />
          <span className="rail__label">{s.label}</span>
        </li>
      ))}
    </ol>
  );
}
