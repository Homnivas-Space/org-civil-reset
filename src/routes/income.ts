import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";

type Bindings = { DB: D1Database; JWT_SECRET: string };
type Variables = { applicantId: string };

const income = new Hono<{ Bindings: Bindings; Variables: Variables }>();
income.use("*", requireAuth);

interface IncomeBody {
  monthlyIncome?: number;
  monthlyEmi?: number;
}

// Manual entry only. Statement upload isn't built — it's the same
// undesigned-AI-parsing situation as CIBIL, deferred for the same reason.
income.post("/declare", async (c) => {
  const applicantId = c.get("applicantId");
  const { monthlyIncome, monthlyEmi } = await c.req.json<IncomeBody>();

  if (typeof monthlyIncome !== "number" || typeof monthlyEmi !== "number") {
    return c.json({ error: "monthlyIncome and monthlyEmi are required numbers" }, 400);
  }

  await c.env.DB.prepare(
    `INSERT INTO income_declarations
      (id, applicant_id, monthly_income, monthly_emi, source, created_at)
     VALUES (?, ?, ?, ?, 'manual', ?)`
  )
    .bind(
      crypto.randomUUID(),
      applicantId,
      monthlyIncome,
      monthlyEmi,
      Math.floor(Date.now() / 1000)
    )
    .run();

  return c.json({ ok: true });
});

export default income;
