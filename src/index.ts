import { Hono } from "hono";
import auth from "./routes/auth";
import kyc from "./routes/kyc";
import cibil from "./routes/cibil";
import dashboard from "./routes/dashboard";

type Bindings = {
  DB: D1Database;
  OTP_KV: KVNamespace;
  ASSETS: Fetcher;
  JWT_SECRET: string;
  PAN_PEPPER: string;
  RESEND_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.route("/api/auth", auth);
app.route("/api/kyc", kyc);
app.route("/api/cibil", cibil);
app.route("/api/dashboard", dashboard);

// Everything else (anything not under /api/*) is served by the platform
// from ./public per wrangler.toml — this Worker never sees those requests
// unless run_worker_first is widened later.

export default app;
