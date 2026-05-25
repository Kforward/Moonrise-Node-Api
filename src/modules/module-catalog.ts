export const BACKEND_MODULES = [
  "auth",
  "users",
  "cycle",
  "backup",
  "privacy",
  "sync",
  "audit",
] as const;

export type BackendModuleName = (typeof BACKEND_MODULES)[number];
