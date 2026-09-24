import { Hono } from "hono";
import auth from "./routes/auth";
import kyc from "./routes/kyc";
import cibil from "./routes/cibil";
import income from "./routes/income";
import dashboard from "./routes/dashboard";
import payment from "./routes/payment";
import documents from "./routes/documents";

type Bindings = {
  DB: D1Database;
  OTP_KV: KVNamespace;
  ASSETS: Fetcher;
  JWT_SECRET: string;
  PAN_PEPPER: string;
  RESEND_API_KEY: string;
  OPENROUTER_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.route("/api/auth", auth);
app.route("/api/kyc", kyc);
app.route("/api/cibil", cibil);
app.route("/api/income", income);
app.route("/api/dashboard", dashboard);
app.route("/api/payment", payment);
app.route("/api/documents", documents);

export default app;
