import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  // Check if admin already exists
  const existingAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
  });

  if (existingAdmin) {
    console.log("Admin user already exists. Skipping seed.");
    return;
  }

  // Create default admin user
  const hashedPassword = await bcrypt.hash("admin123", 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@sellrush.com",
      password: hashedPassword,
      firstName: "Admin",
      lastName: "User",
      phone: "+234901234567",
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log("✅ Admin user created successfully!");
  console.log(`Email: ${admin.email}`);
  console.log(`Password: admin123`);
  console.log(
    "\n⚠️  IMPORTANT: Change the default password after first login!",
  );
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
