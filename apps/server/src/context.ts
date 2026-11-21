import type { Database } from "better-sqlite3";
import type { loadContent } from "./cards";

export interface ServerContext {
  db: Database;
  content: ReturnType<typeof loadContent>;
  jwtSecret: string;
}

export const ctx = {} as ServerContext;

export function initContext(value: ServerContext): void {
  Object.assign(ctx, value);
}
