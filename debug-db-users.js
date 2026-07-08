require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
      },
      take: 20,
    });
    console.log("USERS:", JSON.stringify(users, null, 2));
  } catch (e) {
    console.error("ERROR:", e);
  } finally {
    await prisma.$disconnect();
  }
})();
