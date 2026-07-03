import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  // Check if admin already exists
  const existingAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
  });

  if (existingAdmin) {
    console.log("Admin user already exists.");
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

// Ensure a test seller exists
async function ensureTestSeller() {
  const existingSeller = await prisma.seller.findFirst({ where: { handle: "jerrys-place" } });
  if (existingSeller) {
    console.log("Test seller already exists. Skipping seller seed.");
    return;
  }

  // Create a dummy user to own the seller
  const sellerUser = await prisma.user.create({
    data: {
      email: "jerry@sellrush.com",
      password: await bcrypt.hash("seller123", 10),
      firstName: "Jerry",
      lastName: "Seller",
      role: "CUSTOMER",
      isActive: true,
    },
  });

  const seller = await prisma.seller.create({
    data: {
      userId: sellerUser.id,
      businessName: "Jerry's Place",
      handle: "jerrys-place",
      slug: "jerrys-place",
      email: "jerry@sellrush.com",
      phone: "+234800000000",
      description: "A demo seller for testing the marketplace",
      isVerified: true,
      status: "active",
    },
  });

  console.log("✅ Test seller created:", seller.handle);

  // Create a sample product for the seller
  const existingProduct = await prisma.product.findFirst({ where: { slug: "demo-product-jerry" } });
  if (!existingProduct) {
    await prisma.product.create({
      data: {
        name: "Demo Product from Jerry",
        slug: "demo-product-jerry",
        description: "Demo product for seller storefront",
        price: 19.99,
        cost: 10,
        stock: 100,
        category: "demo",
        images: [],
        tags: ["demo"],
        isActive: true,
        sellerId: seller.id,
        sellerHandle: seller.handle,
      },
    });
    console.log("✅ Sample product created for test seller.");
  }
}

// Run seller seed
ensureTestSeller();

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
