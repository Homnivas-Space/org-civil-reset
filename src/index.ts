import { Hono } from "hono";
import { logError, logInfo } from "./lib/logger";
import auth from "./routes/auth";
import kyc from "./routes/kyc";
import cibil from "./routes/cibil";
import income from "./routes/income";
import dashboard from "./routes/dashboard";

type Bindings = {
  DB: D1Database;
  OTP_KV: KVNamespace;
  ASSETS: Fetcher;
  JWT_SECRET: string;
  PAN_PEPPER: string;
  RESEND_API_KEY: string;
  OPENROUTER_API_KEY: string;
};
type Variables = { requestId: string };

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Every request gets a short id, logged on the way out with its status
// and duration. This is what ties a "500" seen in the browser to a
// specific, findable entry in Cloudflare's Workers Logs dashboard —
// without it, "it failed" and the logs have no way to connect.
app.use("*", async (c, next) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  c.set("requestId", requestId);
  const start = Date.now();
  await next();
  logInfo("request", {
    requestId,
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    ms: Date.now() - start,
  });
});

app.route("/api/auth", auth);
app.route("/api/kyc", kyc);
app.route("/api/cibil", cibil);
app.route("/api/income", income);
app.route("/api/dashboard", dashboard);

// Catches anything thrown by any route that wasn't already handled.
// Before this, an unhandled error (a bad D1 query, a missing binding, an
// unexpected null) was an opaque 500 with an empty body and nothing
// logged — exactly the dead end "Failed to load resource: 500" is.
app.onError((err, c) => {
  const requestId = c.get("requestId");
  logError("unhandled_error", err, {
    requestId,
    method: c.req.method,
    path: c.req.path,
  });
  return c.json(
    { error: "Something went wrong on our end", requestId: requestId ?? null },
    500
  );
});

// Everything else (anything not under /api/*) is served by the platform
// from ./public per wrangler.toml.

export default app;
