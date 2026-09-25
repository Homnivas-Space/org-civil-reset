import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { extractPdfText } from "../lib/pdf-text";
import { chatCompletion } from "../lib/openrouter";
import { logError } from "../lib/logger";

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  OPENROUTER_API_KEY: string;
};
type Variables = { applicantId: string; requestId: string };

const cibil = new Hono<{ Bindings: Bindings; Variables: Variables }>();
cibil.use("*", requireAuth);

const SYSTEM_PROMPT = `You read Indian credit bureau reports (CIBIL/TransUnion, Experian, Equifax, CRIF) and extract specific facts as JSON. Output ONLY a single JSON object, no prose, no markdown fences, matching exactly this shape:
{
  "report_date": string | null,
  "score": number | null,
  "active_loans": number | null,
  "overdue_count": number | null,
  "inquiries_last_6m": number | null,
  "has_writeoff_or_settled": boolean,
  "summary": string
}
report_date: "YYYY-MM-DD" if found in the text, else null.
score: the credit score as a plain number.
active_loans: count of currently open/active loan or credit accounts.
overdue_count: count of accounts currently overdue or delinquent.
inquiries_last_6m: count of hard inquiries in the last 6 months.
has_writeoff_or_settled: true if ANY account shows written-off or settled status.
summary: 2-3 plain-English sentences explaining the above to someone with no credit background.
If a field truly cannot be found, use null (or false for the boolean) — never guess a number.`;

// PROVISIONAL, see the note above this file's route: the model is the
// extractor here, not a narrator over deterministic parsing, because we
// have no real sample report to build a reliable parser against yet.
cibil.post("/upload", async (c) => {
  const requestId = c.get("requestId");
  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.includes("pdf")) {
    return c.json(
      { error: "Send the PDF as the raw request body with Content-Type: application/pdf", requestId },
      400
    );
  }

  const applicantId = c.get("applicantId");
  const bytes = await c.req.arrayBuffer();

  if (bytes.byteLength === 0) {
    return c.json({ error: "Empty file", requestId }, 400);
  }

  let text: string;
  try {
    text = await extractPdfText(bytes);
  } catch (err) {
    logError("cibil_pdf_extract_failed", err, { requestId, applicantId });
    return c.json(
      { error: "Could not read this PDF — it may be a scanned image rather than text", requestId },
      422
    );
  }

  if (text.trim().length < 50) {
    return c.json(
      { error: "No readable text found — scanned/image-only PDFs aren't supported yet", requestId },
      422
    );
  }

  // Free-tier models have real context limits; the report body is what
  // matters, not megabytes of repeated boilerplate/legal text.
  const truncated = text.slice(0, 15000);

  const result = await chatCompletion(c.env, SYSTEM_PROMPT, truncated);
  if (!result.ok) {
    logError("cibil_ai_parse_failed", new Error(result.error), {
      requestId,
      applicantId,
      status: result.status,
    });
    if (result.status === 429) {
      return c.json({ error: "AI parsing is rate-limited right now, try again shortly", requestId }, 429);
    }
    return c.json({ error: "Could not parse this report, try again", requestId }, 502);
  }

  let parsed: {
    report_date: string | null;
    score: number | null;
    active_loans: number | null;
    overdue_count: number | null;
    inquiries_last_6m: number | null;
    has_writeoff_or_settled: boolean;
    summary: string;
  };
  try {
    const cleaned = result.content.trim().replace(/^```(json)?\s*|\s*```$/g, "");
    parsed = JSON.parse(cleaned);
  } catch (err) {
    logError("cibil_ai_response_unparseable", err, {
      requestId,
      applicantId,
      rawContent: result.content.slice(0, 500),
    });
    return c.json({ error: "AI returned an unreadable response, try again", requestId }, 502);
  }

  const reportId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  try {
    await c.env.DB.prepare(
      `INSERT INTO cibil_reports
        (id, applicant_id, report_date, score, active_loans, overdue_count, inquiries_last_6m, has_writeoff_or_settled, ai_summary, parsed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        reportId,
        applicantId,
        parsed.report_date,
        parsed.score,
        parsed.active_loans,
        parsed.overdue_count,
        parsed.inquiries_last_6m,
        parsed.has_writeoff_or_settled ? 1 : 0,
        parsed.summary,
        now
      )
      .run();
  } catch (err) {
    logError("cibil_report_db_write_failed", err, { requestId, applicantId });
    return c.json({ error: "Parsed successfully but could not save the result, try again", requestId }, 500);
  }

  // The PDF bytes and the extracted text both go out of scope when this
  // request ends — neither is ever written anywhere, per the no-storage decision.
  return c.json({ ok: true, reportId, ...parsed });
});

export default cibil;
