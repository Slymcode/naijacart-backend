const { PrismaClient } = require('@prisma/client');
(async () => {
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL || 'postgresql://sellrush_user:dEaaiZ4kVx98XVg3QzeOLSHRq4DCx9yj@dpg-d901rdm8bjmc738qhkl0-a.ohio-postgres.render.com/sellrush?sslmode=require' } } });
  try {
    const rows = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`;
    console.log(JSON.stringify(rows, null, 2));
  } finally {
    await prisma.$disconnect();
  }
})();
