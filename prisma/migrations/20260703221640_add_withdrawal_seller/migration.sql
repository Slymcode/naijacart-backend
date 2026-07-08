/*
  Warnings:

  - The values [SUPER_ADMIN,SELLER] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `productId` on the `Commission` table. All the data in the column will be lost.
  - You are about to drop the column `sellerId` on the `Commission` table. All the data in the column will be lost.
  - You are about to drop the column `recipientType` on the `PaymentSplit` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `PaymentSplit` table. All the data in the column will be lost.
  - You are about to drop the column `sellerId` on the `Review` table. All the data in the column will be lost.
  - You are about to drop the `PlatformAccount` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SellerWallet` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WalletTransaction` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `sellerId` on table `PaymentSplit` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'CUSTOMER', 'AFFILIATE');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING (
  CASE
    WHEN "role"::text = 'SUPER_ADMIN' THEN 'ADMIN'
    WHEN "role"::text = 'SELLER' THEN 'CUSTOMER'
    ELSE "role"::text
  END
)::"UserRole_new";
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';
COMMIT;

-- DropForeignKey
ALTER TABLE "Commission" DROP CONSTRAINT "Commission_orderId_fkey";

-- DropForeignKey
ALTER TABLE "Commission" DROP CONSTRAINT "Commission_productId_fkey";

-- DropForeignKey
ALTER TABLE "Commission" DROP CONSTRAINT "Commission_sellerId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentSplit" DROP CONSTRAINT "PaymentSplit_sellerId_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_sellerId_fkey";

-- DropForeignKey
ALTER TABLE "SellerWallet" DROP CONSTRAINT "SellerWallet_sellerId_fkey";

-- DropForeignKey
ALTER TABLE "WalletTransaction" DROP CONSTRAINT "WalletTransaction_walletId_fkey";

-- DropIndex
DROP INDEX "Commission_productId_idx";

-- DropIndex
DROP INDEX "Commission_sellerId_idx";

-- AlterTable
ALTER TABLE "Commission" DROP COLUMN "productId",
DROP COLUMN "sellerId";

-- AlterTable
ALTER TABLE "PaymentSplit" DROP COLUMN "recipientType",
DROP COLUMN "status",
ALTER COLUMN "sellerId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Review" DROP COLUMN "sellerId";

-- AlterTable
ALTER TABLE "WithdrawalRequest" ADD COLUMN     "sellerId" TEXT;

-- DropTable
DROP TABLE "PlatformAccount";

-- DropTable
DROP TABLE "SellerWallet";

-- DropTable
DROP TABLE "WalletTransaction";

-- DropEnum
DROP TYPE "PaymentSplitStatus";

-- DropEnum
DROP TYPE "RecipientType";

-- DropEnum
DROP TYPE "WalletTransactionType";

-- CreateIndex
CREATE INDEX "WithdrawalRequest_sellerId_idx" ON "WithdrawalRequest"("sellerId");

-- AddForeignKey
ALTER TABLE "PaymentSplit" ADD CONSTRAINT "PaymentSplit_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE SET NULL ON UPDATE CASCADE;
