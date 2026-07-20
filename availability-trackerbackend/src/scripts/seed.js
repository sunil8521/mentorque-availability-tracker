/**
 * Seed script: Creates 1 admin, 5 mentors, 10 users with tags & descriptions.
 * Run: node src/scripts/seed.js
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = "password123";

const ADMIN = {
  name: "Admin User",
  email: "admin@mentorque.com",
  password: "admin123",
  role: "ADMIN",
  description: "Platform administrator for Mentorque scheduling system.",
  tags: ["admin", "platform"],
};

const MENTORS = [
  {
    name: "Arjun Patel",
    email: "arjun.patel@mentorque.com",
    description:
      "Staff Engineer at Google with 8 years in distributed systems. Expert in system design interviews and backend architecture. Previously at Amazon and Microsoft.",
    tags: ["tech", "big-tech", "senior-developer", "backend", "system-design", "google"],
  },
  {
    name: "Priya Sharma",
    email: "priya.sharma@mentorque.com",
    description:
      "HR Director at Infosys with 10+ years in talent acquisition. Career transition specialist, resume reviewer, and interview coach. Has helped 500+ professionals land their dream jobs.",
    tags: ["non-tech", "good-communication", "career-coach", "hr", "resume-expert"],
  },
  {
    name: "Rahul Gupta",
    email: "rahul.gupta@mentorque.com",
    description:
      "Principal Engineer at Meta. React/Next.js specialist with 6 years conducting frontend interviews. Open source contributor and tech speaker.",
    tags: ["tech", "frontend", "big-tech", "react", "nextjs", "senior-developer"],
  },
  {
    name: "Sneha Iyer",
    email: "sneha.iyer@mentorque.com",
    description:
      "SDE-3 at Amazon India. Known for structured mock interviews and mentoring junior engineers. Strong communicator who simplifies complex backend concepts.",
    tags: ["tech", "backend", "india", "good-communication", "java", "amazon"],
  },
  {
    name: "Vikram Rao",
    email: "vikram.rao@mentorque.com",
    description:
      "Engineering Manager at Stripe Dublin. System design, scaling, and DevOps expertise. Led teams building payment infrastructure for millions of users.",
    tags: ["tech", "system-design", "public-company", "ireland", "devops", "senior-developer"],
  },
];

const USERS = [
  {
    name: "Amit Kumar",
    email: "amit.kumar@gmail.com",
    description:
      "Final year CS student at IIT Delhi. Building projects in React and Next.js. Looking for frontend SDE roles at product companies.",
    tags: ["tech", "frontend", "react", "nextjs"],
  },
  {
    name: "Neha Singh",
    email: "neha.singh@gmail.com",
    description:
      "2 years experience as Python/Django backend developer at a fintech startup. Preparing for backend SDE interviews at product companies.",
    tags: ["tech", "backend", "python", "django"],
  },
  {
    name: "Rohan Verma",
    email: "rohan.verma@gmail.com",
    description:
      "Full-stack MERN developer with 1.5 years at a Series-A startup. Targeting mid-level full-stack roles at tech companies.",
    tags: ["tech", "fullstack", "nodejs", "react", "mongodb"],
  },
  {
    name: "Kavya Reddy",
    email: "kavya.reddy@gmail.com",
    description:
      "MBA graduate from IIM Bangalore transitioning to product management. Needs help with resume positioning and market strategy.",
    tags: ["non-tech", "product-management", "mba"],
  },
  {
    name: "Saurabh Joshi",
    email: "saurabh.joshi@gmail.com",
    description:
      "3 years at TCS in Java/Spring Boot microservices. Preparing for system design rounds at FAANG companies.",
    tags: ["tech", "system-design", "java", "backend", "microservices"],
  },
  {
    name: "Meera Nair",
    email: "meera.nair@gmail.com",
    description:
      "Frontend developer at Wipro working with Angular and TypeScript. Wants to switch to a big tech company.",
    tags: ["tech", "frontend", "angular", "typescript"],
  },
  {
    name: "Aditya Prakash",
    email: "aditya.prakash@gmail.com",
    description:
      "DevOps engineer specializing in AWS, Kubernetes, and CI/CD. Looking for senior cloud infrastructure roles.",
    tags: ["tech", "devops", "aws", "cloud", "kubernetes"],
  },
  {
    name: "Pooja Gupta",
    email: "pooja.gupta@gmail.com",
    description:
      "Marketing professional with 4 years experience exploring tech-adjacent roles in product marketing and growth.",
    tags: ["non-tech", "good-communication", "marketing"],
  },
  {
    name: "Karthik Rajan",
    email: "karthik.rajan@gmail.com",
    description:
      "Go developer at an early-stage startup building microservices. Preparing for senior backend interviews at scale-ups.",
    tags: ["tech", "backend", "golang", "microservices"],
  },
  {
    name: "Divya Menon",
    email: "divya.menon@gmail.com",
    description:
      "Data scientist at Flipkart with expertise in Python and ML. Exploring ML engineering roles at FAANG companies.",
    tags: ["tech", "data-science", "python", "ml", "ai"],
  },
];

async function upsertUser({ name, email, password, role, description, tags }) {
  const hash = await bcrypt.hash(password || DEFAULT_PASSWORD, 12);
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        name,
        role,
        password: hash,
        description,
        tags,
      },
    });
    console.log(`  ✓ Updated ${role}: ${email}`);
    return updated;
  }

  const created = await prisma.user.create({
    data: {
      id: uuidv4(),
      name,
      email: email.toLowerCase(),
      password: hash,
      role,
      timezone: "UTC",
      description,
      tags,
    },
  });
  console.log(`  ✓ Created ${role}: ${email}`);
  return created;
}

async function main() {
  console.log("\n🌱 Seeding Mentorque database...\n");

  // 1. Admin
  console.log("👤 Admin:");
  await upsertUser({ ...ADMIN });

  // 2. Mentors
  console.log("\n🧑‍🏫 Mentors:");
  for (const mentor of MENTORS) {
    await upsertUser({ ...mentor, password: DEFAULT_PASSWORD, role: "MENTOR" });
  }

  // 3. Users
  console.log("\n👥 Users:");
  for (const user of USERS) {
    await upsertUser({ ...user, password: DEFAULT_PASSWORD, role: "USER" });
  }

  console.log("\n✅ Seeding complete!");
  console.log("\n📋 Login credentials:");
  console.log("  Admin:   admin@mentorque.com / admin123");
  console.log("  Mentors: <name>@mentorque.com / password123");
  console.log("  Users:   <name>@gmail.com / password123");
  console.log("");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
