/*
  Warnings:

  - A unique constraint covering the columns `[userId,productId,affiliateCode]` on the table `CartItem` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "CartItem_userId_productId_key";

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "affiliateCode" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_userId_productId_affiliateCode_key" ON "CartItem"("userId", "productId", "affiliateCode");
