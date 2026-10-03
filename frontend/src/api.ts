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
  created_at: string;
  updated_at: string;
}

export interface Source { title: string; url: string }
export interface Research {
  summary: string;
  market_trend: string;
  competitors: { name: string; what_they_do: string; weakness: string }[];
  user_complaints: string[];
  opportunities: string[];
  sources: Source[];
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
export interface Build {
  template: Template;
  selected_features: string[];
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
  listProjects: () => request<Project[]>("/projects"),
  getProject: (id: number) => request<Project>(`/projects/${id}`),
  createProject: (name: string, idea: string) =>
    request<Project>("/projects", { method: "POST", body: JSON.stringify({ name, idea }) }),
  updateProject: (id: number, patch: Partial<Pick<Project, "name" | "idea">>) =>
    request<Project>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteProject: (id: number) => request<void>(`/projects/${id}`, { method: "DELETE" }),

  getResults: async (id: number): Promise<Results> => {
    const list = await request<StageResult[]>(`/projects/${id}/results`);
    return Object.fromEntries(list.map((r) => [r.stage, r.data])) as Results;
  },
  runStage: (id: number, stage: "research" | "validate" | "plan") =>
    request<StageResult>(`/projects/${id}/${stage}`, { method: "POST" }),
  build: (id: number, selected_features: string[], template: Template) =>
    request<StageResult>(`/projects/${id}/build`, {
      method: "POST",
      body: JSON.stringify({ selected_features, template }),
    }),
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
