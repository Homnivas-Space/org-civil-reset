import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";

type Bindings = { DB: D1Database; JWT_SECRET: string };
type Variables = { applicantId: string };

const dashboard = new Hono<{ Bindings: Bindings; Variables: Variables }>();
dashboard.use("*", requireAuth);

dashboard.get("/", async (c) => {
  const applicantId = c.get("applicantId");

  const applicant = await c.env.DB.prepare(
    "SELECT name, email, pan_masked FROM applicants WHERE id = ?"
  )
    .bind(applicantId)
    .first();

  if (!applicant) {
    return c.json({ error: "Applicant not found" }, 404);
  }

  const cibilReport = await c.env.DB.prepare(
    "SELECT * FROM cibil_reports WHERE applicant_id = ? ORDER BY parsed_at DESC LIMIT 1"
  )
    .bind(applicantId)
    .first();

  const income = await c.env.DB.prepare(
    "SELECT * FROM income_declarations WHERE applicant_id = ? ORDER BY created_at DESC LIMIT 1"
  )
    .bind(applicantId)
    .first();

  const application = await c.env.DB.prepare(
    "SELECT * FROM applications WHERE applicant_id = ? ORDER BY created_at DESC LIMIT 1"
  )
    .bind(applicantId)
    .first();

  return c.json({
    applicant,
    cibilReport: cibilReport ?? null,
    income: income ?? null,
    application: application ?? null,
  });
});

export default dashboard;
