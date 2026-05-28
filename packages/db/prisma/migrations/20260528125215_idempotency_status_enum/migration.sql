/*
  Warnings:

  - Changed the type of `status` on the `IdempotencyKey` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- AlterTable
ALTER TABLE "IdempotencyKey" DROP COLUMN "status",
ADD COLUMN     "status" "IdempotencyStatus" NOT NULL;
