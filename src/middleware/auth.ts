import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { verify } from "hono/jwt";

type Env = {
  Bindings: { JWT_SECRET: string };
  Variables: { applicantId: string };
};

/**
 * Protects a route behind the "session" cookie set at login.
 * On success, c.get("applicantId") is available to downstream handlers.
 * Usage: app.get("/dashboard", requireAuth, (c) => { ... })
 */
export const requireAuth: MiddlewareHandler<Env> = async (c, next) => {
  const token = getCookie(c, "session");
  if (!token) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  try {
    const payload = await verify(token, c.env.JWT_SECRET);
    c.set("applicantId", payload.sub as string);
  } catch {
    return c.json({ error: "Session expired, please log in again" }, 401);
  }

  await next();
};
