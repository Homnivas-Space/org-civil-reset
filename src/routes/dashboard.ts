import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";

type Bindings = { DB: D1Database; JWT_SECRET: string };
type Variables = { applicantId: string };

const dashboard = new Hono<{ Bindings: Bindings; Variables: Variables }>();

dashboard.use("*", requireAuth);

// NOT IMPLEMENTED — CIBIL summary, income/EMI, and the 4-stage progress
// tracker (account_opened -> payment_done -> card_received -> active)
// haven't been designed yet. requireAuth is wired so the pattern for every
// protected route going forward is already correct.
dashboard.get("/", async (c) => {
  const applicantId = c.get("applicantId");
  return c.json({ error: "Not implemented yet", applicantId }, 501);
});

export default dashboard;
