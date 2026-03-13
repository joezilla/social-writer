import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || process.argv[2];
  const password = process.env.ADMIN_PASSWORD || process.argv[3];

  if (!email || !password) {
    console.error("Usage: tsx scripts/seed-admin.ts <email> <password>");
    console.error("  or set ADMIN_EMAIL and ADMIN_PASSWORD env vars");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`User ${email} already exists (id: ${existing.id}, role: ${existing.role})`);
    process.exit(0);
  }

  const passwordHash = await hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "admin",
      name: "Admin",
    },
  });

  console.log(`Admin user created: ${user.email} (id: ${user.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
