export const BACKEND_MODULES = [
  "app",
  "auth",
  "users",
  "cycle",
  "backup",
  "privacy",
  "sync",
  "audit",
] as const;

export type BackendModuleName = (typeof BACKEND_MODULES)[number];
