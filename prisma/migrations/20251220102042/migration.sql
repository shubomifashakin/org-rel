/*
  Warnings:

  - You are about to drop the column `lastUsedAt` on the `RefreshTokens` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "RefreshTokens" DROP COLUMN "lastUsedAt";
