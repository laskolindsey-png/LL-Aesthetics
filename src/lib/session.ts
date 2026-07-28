import { SignJWT, jwtVerify } from "jose";

// Signed session tokens (JWT via jose). Edge-safe — used by middleware AND
// server code. No Node-only APIs here so it can run in the middleware runtime.

export const SESSION_COOKIE = "llaos_session";
const encoder = new TextEncoder();

function secretKey(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("SESSION_SECRET is missing or too short (need 16+ characters).");
  }
  return encoder.encode(s);
}

export type SessionPayload = {
  userId: string;
  email: string;
  role: string;
  name?: string;
};

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      userId: String(payload.userId),
      email: String(payload.email),
      role: String(payload.role),
      name: payload.name as string | undefined,
    };
  } catch {
    return null;
  }
}
