import { useOutletContext } from "react-router-dom";
import type { Project, Results } from "../../api";

export interface ProjectCtx {
  project: Project;
  results: Results;
  refresh: () => Promise<Results>;
  setProject: (p: Project) => void;
}

export const useProject = () => useOutletContext<ProjectCtx>();

export const STAGE_TABS = [
  { path: "research", label: "Research" },
  { path: "validate", label: "Validate" },
  { path: "plan", label: "Plan" },
  { path: "build", label: "Build" },
] as const;

/** Which stage pages are open, based on what has been done. */
export function unlocked(r: Results) {
  return { research: true, validate: !!r.research, plan: !!r.validate, build: !!r.build, report: !!r.research };
}
