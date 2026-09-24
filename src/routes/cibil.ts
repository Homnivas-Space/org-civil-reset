import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";

type Bindings = { DB: D1Database; JWT_SECRET: string };
type Variables = { applicantId: string };

const cibil = new Hono<{ Bindings: Bindings; Variables: Variables }>();

cibil.use("*", requireAuth);

// NOT IMPLEMENTED — this is where the uploaded PDF gets parsed:
// extract text/tables server-side first, use the free-tier OpenRouter
// model to summarize/explain the already-parsed numbers (not as the
// source of truth for them), then write only the extracted JSON to
// `cibil_reports`. The PDF itself is never persisted (per the no-storage
// decision) — held in memory just long enough to process, then dropped.
cibil.post("/upload", async (c) => {
  return c.json({ error: "Not implemented yet" }, 501);
});

export default cibil;
