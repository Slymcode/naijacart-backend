# SellRush Marketplace - Sellers Upgrade

This document outlines the steps added for the multi-vendor sellers upgrade and how to run migrations and seed data locally.

## Migrations

After schema changes were made to `prisma/schema.prisma`, a migration was created:

```bash
cd sellrush-backend
npx prisma migrate dev --name add_seller
```

This will update your local development database. If you need to apply migrations in production, use `prisma migrate deploy`.

## Seeding

A seed script was added that creates a default admin and a test seller with a sample product.

Run the seed:

```bash
cd sellrush-backend
npx ts-node prisma/seed.ts
# or if you have npm script
npm run db:seed
```

## New Endpoints

- `POST /api/sellers` - register as a seller (authenticated)
- `GET /api/sellers/:handle` - public seller storefront
- `GET /api/sellers/:handle/products` - seller product listing
- `GET /api/sellers/me/orders` - get orders for current seller (authenticated)
- `GET /api/sellers/me/analytics` - get seller analytics (authenticated)
- `POST /api/uploads/seller-asset` - upload logos/banners
- `POST /api/uploads/product-image` - upload product images

## Running Locally

1. Ensure `.env` is configured with `DATABASE_URL` and `FRONTEND_URL`.
2. Run migrations (see above).
3. Seed the DB.
4. Start backend:

```bash
cd sellrush-backend
npm install
npm run start:dev
```

5. Start frontend:

```bash
cd sellrush-frontend
npm install
npm run dev
```

## Notes

- Uploaded files are saved to `public/uploads` in development and served from `/public`.
- In production, configure `UPLOAD_PROVIDER` or use S3/Cloudinary and update upload service.
