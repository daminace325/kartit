/*
  Warnings:

  - Changed the type of `type` on the `Promotion` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- AlterTable
ALTER TABLE "Promotion" DROP COLUMN "type",
ADD COLUMN     "type" "PromotionType" NOT NULL;
