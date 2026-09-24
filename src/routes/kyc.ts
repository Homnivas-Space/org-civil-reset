import { Hono } from "hono";

type Bindings = { DB: D1Database; PAN_PEPPER: string };

const kyc = new Hono<{ Bindings: Bindings }>();

// NOT IMPLEMENTED — the form fields, Aadhaar masking, and write to
// `applicants` haven't been designed yet. When they are: this is where
// hashPanDob() (src/lib/pan.ts) gets called before the row is written.
kyc.post("/submit", async (c) => {
  return c.json({ error: "Not implemented yet" }, 501);
});

export default kyc;
