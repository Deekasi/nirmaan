const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export const STAGES = [
  { key: "research", label: "Research" },
  { key: "validate", label: "Validate" },
  { key: "plan", label: "Plan" },
  { key: "build", label: "Base project" },
  { key: "download", label: "Download" },
] as const;

export type Stage = (typeof STAGES)[number]["key"];

export interface User {
  id: number;
  email: string;
  name: string;
}

export interface Project {
  id: number;
  name: string;
  idea: string;
  stage: Stage;
  status: "active" | "finished";
  github_url: string | null;
  live_url: string | null;
  notes: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectSummary extends Project {
  verdict: "go" | "pivot" | "rethink" | null;
  feasibility: number | null;
  template: Template | null;
}

export interface Source { id: number; title: string; url: string; domain: string; snippet?: string }
export type ResearchMethod = "web_search" | "ai_search" | "ai_knowledge" | "demo";
export interface Research {
  summary: string;
  market_trend: string;
  market_size?: string;
  key_numbers?: { label: string; value: string; source: number | null }[];
  target_segments?: string[];
  india_angle?: string;
  swot?: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] } | null;
  competitors: { name: string; what_they_do: string; weakness: string; pricing?: string }[];
  user_complaints: string[];
  opportunities: string[];
  sources: Source[];
  queries: string[];
  method: ResearchMethod;
  note?: string;
  interpretation?: string;
}
export interface Validation {
  target_user: string;
  problem_statement: string;
  unique_angle: string;
  risks: string[];
  feasibility_score: number;
  verdict: "go" | "pivot" | "rethink";
  verdict_reason: string;
}
export type Priority = "must" | "nice" | "later";
export type Template = "landing" | "webapp" | "chatbot";
export interface Plan {
  features: { name: string; description: string; priority: Priority }[];
  recommended_template: Template;
  template_reason: string;
  tech_stack: { layer: string; choice: string; why: string }[];
  beginner_explanation: string;
  viva_questions: { question: string; answer: string }[];
}
export interface CheckStep { name: string; status: "pass" | "warn" | "fail" | "skip"; detail: string; ms: number }
export interface Checks {
  steps: CheckStep[];
  passed: number;
  total: number;
  ship_ready: boolean;
  files: { path: string; lines: number; bytes: number; lang: string }[];
  lines_by_language: Record<string, number>;
  total_lines: number;
}
export interface Mission { id: string; title: string; detail: string; difficulty: "easy" | "medium" | "hard"; skills: string[] }
export interface Build {
  template: Template;
  selected_features: string[];
  checks?: Checks;
  missions?: Mission[];
  missions_done?: string[];
  config: {
    app_name: string;
    tagline: string;
    description: string;
    audience: string;
    primary_color: string;
    features: { title: string; description: string }[];
  };
}
export interface Results {
  research?: Research;
  validate?: Validation;
  plan?: Plan;
  build?: Build;
}
interface StageResult { stage: keyof Results; data: unknown }

export const TOPICS = [
  { key: "all", label: "Everything" },
  { key: "ai", label: "AI" },
  { key: "education", label: "Education" },
  { key: "health", label: "Health" },
  { key: "fintech", label: "Fintech" },
  { key: "agriculture", label: "Agriculture" },
  { key: "climate", label: "Climate" },
  { key: "mobility", label: "Mobility" },
] as const;
export type Topic = (typeof TOPICS)[number]["key"];
export interface TrendReport {
  topic: Topic;
  headline: string;
  trends: { title: string; why_now: string; example_ideas: string[]; difficulty: "beginner" | "intermediate" | "advanced"; sources: number[] }[];
  sources: Source[];
  method: ResearchMethod;
  updated_at: string;
  cached: boolean;
}

interface TokenResponse {
  access_token: string;
  user: User;
}

const TOKEN_KEY = "nirmaan_token";
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(0, "Can't reach the Nirmaan server. Check that the backend is running on port 8000.");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = Array.isArray(data.detail)
      ? data.detail.map((d: { msg: string }) => d.msg).join(". ")
      : data.detail;
    throw new ApiError(res.status, detail ?? "Something went wrong.");
  }
  return data as T;
}

export const api = {
  register: (email: string, name: string, password: string) =>
    request<TokenResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, name, password }),
    }),
  login: (email: string, password: string) =>
    request<TokenResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => request<User>("/auth/me"),
  forgotPassword: (email: string) =>
    request<{ message: string }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string) =>
    request<{ message: string }>("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) }),
  listProjects: () => request<ProjectSummary[]>("/projects"),
  getProject: (id: number) => request<Project>(`/projects/${id}`),
  createProject: (name: string, idea: string) =>
    request<Project>("/projects", { method: "POST", body: JSON.stringify({ name, idea }) }),
  updateProject: (id: number, patch: Partial<Pick<Project, "name" | "idea" | "status" | "github_url" | "live_url" | "notes">>) =>
    request<Project>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteProject: (id: number) => request<void>(`/projects/${id}`, { method: "DELETE" }),

  getResults: async (id: number): Promise<Results> => {
    const list = await request<StageResult[]>(`/projects/${id}/results`);
    const results = Object.fromEntries(list.map((r) => [r.stage, r.data])) as Results;
    // Research saved by older versions has no queries/method and unnumbered sources.
    if (results.research) {
      const r = results.research;
      r.queries = r.queries ?? [];
      r.sources = (r.sources ?? []).map((src, i) => ({
        ...src,
        id: src.id ?? i + 1,
        domain: src.domain ?? new URL(src.url).hostname.replace(/^www\./, ""),
      }));
      r.method = r.method ?? (r.sources.length ? "ai_search" : "ai_knowledge");
    }
    return results;
  },
  runStage: (id: number, stage: "research" | "validate" | "plan") =>
    request<StageResult>(`/projects/${id}/${stage}`, { method: "POST" }),
  build: (id: number, selected_features: string[], template: Template) =>
    request<StageResult>(`/projects/${id}/build`, {
      method: "POST",
      body: JSON.stringify({ selected_features, template }),
    }),
  updateMissions: (id: number, done: string[]) =>
    request<StageResult>(`/projects/${id}/missions`, { method: "PUT", body: JSON.stringify({ done }) }),
  getTrends: (topic: Topic, refresh = false) =>
    request<TrendReport>(`/trends?topic=${topic}${refresh ? "&refresh=true" : ""}`),
  download: async (id: number) => {
    const token = getToken();
    const res = await fetch(`${API_URL}/projects/${id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new ApiError(res.status, "Download failed. Try building the project again.");
    const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "project.zip";
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  },
};
