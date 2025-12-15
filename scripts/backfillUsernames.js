// scripts/backfillUsernames.js
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function normUsername(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._]/g, "");
}

function baseFromEmail(email) {
  const base = (String(email).split("@")[0] || "user").toLowerCase();
  const cleaned = base.replace(/[^a-z0-9._]/g, "");
  return cleaned || `user${Math.floor(1000 + Math.random() * 9000)}`;
}

async function generateUniqueUsername(email) {
  const base = baseFromEmail(email);
  const tries = [
    base,
    `${base}${Math.floor(1000 + Math.random() * 9000)}`,
    `${base}${Date.now().toString().slice(-6)}`,
  ];

  for (const u of tries) {
    const exists = await prisma.user.findUnique({
      where: { username: u },
      select: { id: true },
    });
    if (!exists) return u;
  }
  return `${base}${Date.now()}`;
}

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, username: true },
  });

  let updated = 0;

  for (const u of users) {
    const current = normUsername(u.username);
    if (current) continue;

    const newUsername = await generateUniqueUsername(u.email);

    await prisma.user.update({
      where: { id: u.id },
      data: { username: newUsername },
    });

    updated++;
    console.log("Set username:", u.email, "=>", newUsername);
  }

  console.log("DONE. Updated users:", updated);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });