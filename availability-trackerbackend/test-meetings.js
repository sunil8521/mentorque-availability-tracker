import fetch from "node-fetch";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findFirst();
  if (!user) return console.log("No user found");
  
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
  const r = await fetch("http://localhost:5000/api/meetings", {
    headers: { "Authorization": "Bearer " + token }
  });
  console.log("Status:", r.status);
  const text = await r.text();
  console.log("Response:", text);
}
run();
