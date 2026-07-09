const { PrismaClient } = require('@prisma/client');
(async () => {
  const prisma = new PrismaClient({ datasources: { db: { url: 'postgresql://postgres:jevirux4u2@localhost:5432/naijacart' } } });
  try {
    const rows = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`;
    console.log(JSON.stringify(rows, null, 2));
  } finally {
    await prisma.$disconnect();
  }
})();
