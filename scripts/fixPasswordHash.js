const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, passwordHash: true },
  });

  let changed = 0;

  for (const u of users) {
    const v = String(u.passwordHash || "");

    // already bcrypt
    if (v.startsWith("$2a$") || v.startsWith("$2b$")) continue;

    const hash = await bcrypt.hash(v, 10);

    await prisma.user.update({
      where: { id: u.id },
      data: { passwordHash: hash },
    });

    console.log("hashed:", u.email);
    changed++;
  }

  console.log("DONE. Updated users:", changed);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });