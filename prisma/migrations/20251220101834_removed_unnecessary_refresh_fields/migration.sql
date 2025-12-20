/*
  Warnings:

  - You are about to drop the column `isRevoked` on the `RefreshTokens` table. All the data in the column will be lost.
  - You are about to drop the column `revokedAt` on the `RefreshTokens` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "RefreshTokens" DROP COLUMN "isRevoked",
DROP COLUMN "revokedAt";
