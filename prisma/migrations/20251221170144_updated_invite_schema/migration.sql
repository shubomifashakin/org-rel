/*
  Warnings:

  - You are about to drop the column `invitedByUserId` on the `Invites` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Invites" DROP CONSTRAINT "Invites_invitedByUserId_fkey";

-- AlterTable
ALTER TABLE "Invites" DROP COLUMN "invitedByUserId",
ADD COLUMN     "inviterId" TEXT;

-- AddForeignKey
ALTER TABLE "Invites" ADD CONSTRAINT "Invites_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
