/**
 * One-time script to create an ADMIN user.
 * Run: node src/scripts/seedAdmin.js
 * Set ADMIN_EMAIL and ADMIN_PASSWORD in env, or edit below.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME;

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL.toLowerCase() },
  });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: "ADMIN" },
    });
    console.log("Updated existing user to ADMIN:", existing.email);
    return;
  }
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await prisma.user.create({
    data: {
      id: uuidv4(),
      name: ADMIN_NAME,
      email: ADMIN_EMAIL.toLowerCase(),
      password: hash,
      role: "ADMIN",
      timezone: "UTC",
    },
  });
  console.log("Created ADMIN user:", ADMIN_EMAIL);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
