CREATE TABLE IF NOT EXISTS "PlatformAccount" (
  "id" TEXT NOT NULL,
  "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SellerWallet" (
  "id" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "pending" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerWallet_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SellerWallet_sellerId_key" UNIQUE ("sellerId")
);

CREATE TABLE IF NOT EXISTS "WalletTransaction" (
  "id" TEXT NOT NULL,
  "walletId" TEXT,
  "platformId" TEXT,
  "type" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SellerWallet_sellerId_fkey'
  ) THEN
    ALTER TABLE "SellerWallet"
      ADD CONSTRAINT "SellerWallet_sellerId_fkey"
      FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WalletTransaction_walletId_fkey'
  ) THEN
    ALTER TABLE "WalletTransaction"
      ADD CONSTRAINT "WalletTransaction_walletId_fkey"
      FOREIGN KEY ("walletId") REFERENCES "SellerWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WalletTransaction_platformId_fkey'
  ) THEN
    ALTER TABLE "WalletTransaction"
      ADD CONSTRAINT "WalletTransaction_platformId_fkey"
      FOREIGN KEY ("platformId") REFERENCES "PlatformAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
