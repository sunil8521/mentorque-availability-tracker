import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { v4 as uuidv4 } from "uuid";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

function createToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export async function register(req, res, next) {
  try {
    const { name, email, password, role = "USER", timezone = "UTC" } = req.body;
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: "Name, email and password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    const allowedRoles = ["USER", "MENTOR"];
    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }
    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        id: uuidv4(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: hashed,
        role: role || "USER",
        timezone: timezone === "IST" ? "IST" : "UTC",
      },
      select: { id: true, name: true, email: true, role: true, timezone: true, createdAt: true },
    });
    const token = createToken({ id: user.id, role: user.role, email: user.email });
    res.status(201).json({ user, token });
  } catch (e) {
    next(e);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, name: true, email: true, password: true, role: true, timezone: true, createdAt: true, googleRefreshToken: true },
    });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const token = createToken(user);
    const { password: _p, googleRefreshToken, ...safe } = user;
    res.json({ user: { ...safe, hasGoogleConnected: !!googleRefreshToken }, token });
  } catch (e) {
    next(e);
  }
}

export async function me(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, email: true, role: true, timezone: true, createdAt: true, googleRefreshToken: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    const { googleRefreshToken, ...safe } = user;
    res.json({ user: { ...safe, hasGoogleConnected: !!googleRefreshToken } });
  } catch (e) {
    next(e);
  }
}
