const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export const STAGES = [
  { key: "idea", label: "Idea" },
  { key: "problem", label: "Problem" },
  { key: "prd", label: "PRD" },
  { key: "stack", label: "Stack" },
  { key: "architecture", label: "Architecture" },
  { key: "repo", label: "Repo" },
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
  updateProject: (id: number, patch: Partial<Pick<Project, "name" | "idea" | "stage">>) =>
    request<Project>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteProject: (id: number) => request<void>(`/projects/${id}`, { method: "DELETE" }),
};
