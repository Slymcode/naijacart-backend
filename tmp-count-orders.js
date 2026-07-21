const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  try {
    const count = await prisma.order.count({
      where: { userId: "cmre8jr4x0000121scoj2bub8" },
    });
    console.log(count);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
