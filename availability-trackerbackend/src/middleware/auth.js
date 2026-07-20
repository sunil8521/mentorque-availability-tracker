import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET is required");

// ============================================================================
// DISABLED: SSO / Platform JWT logic (removed per assignment requirements)
// The original code supported dual JWT secrets for Mentorque platform SSO.
// Now using simple JWT auth only.
// ============================================================================
// const MAIN_SITE_JWT_SECRET =
//   process.env.MAIN_SITE_JWT_SECRET || "your-secret-key-change-in-production";
//
// function getDecodedToken(token) {
//   const isPlatformShape = (() => {
//     try {
//       const payload = jwt.decode(token);
//       return payload && typeof payload === "object" && "id" in payload && !("userId" in payload);
//     } catch { return false; }
//   })();
//   if (isPlatformShape && MAIN_SITE_JWT_SECRET) {
//     try { return jwt.verify(token, MAIN_SITE_JWT_SECRET); }
//     catch (e1) {
//       try { return jwt.verify(token, JWT_SECRET); }
//       catch (e2) { return null; }
//     }
//   }
//   try { return jwt.verify(token, JWT_SECRET); }
//   catch (e1) {
//     if (MAIN_SITE_JWT_SECRET) {
//       try { return jwt.verify(token, MAIN_SITE_JWT_SECRET); }
//       catch (e2) { return null; }
//     }
//     return null;
//   }
// }
//
// function roleFromDecoded(decoded) { ... }
// function nameFromDecoded(decoded, email) { ... }
// function isStaleSsoName(name, email) { ... }
// function hasExplicitJwtName(decoded) { ... }
// async function upsertUserFromToken(decoded, email, role, idFromToken, token) { ... }
// ============================================================================

/**
 * Simple JWT authentication middleware.
 * Verifies Bearer token, looks up user in DB, attaches to req.
 */
export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const userId = decoded.userId || decoded.id;
  if (!userId) {
    return res.status(401).json({ error: "Invalid token: missing userId" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true },
  });

  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  req.userId = user.id;
  req.userRole = user.role;
  req.userEmail = user.email;

  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return res
        .status(403)
        .json({
          error: "Insufficient permissions",
          message: `This action requires one of: ${roles.join(", ")}. Your role: ${req.userRole || "none"}.`,
        });
    }
    next();
  };
}

export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : req.cookies?.token;
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId || decoded.id;
    if (!userId) return next();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, email: true },
    });
    if (user) {
      req.userId = user.id;
      req.userRole = user.role;
      req.userEmail = user.email;
    }
  } catch {
    // ignore — optional auth
  }
  next();
}