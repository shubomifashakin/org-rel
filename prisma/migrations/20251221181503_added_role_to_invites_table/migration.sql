/*
  Warnings:

  - Added the required column `role` to the `Invites` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Invites" ADD COLUMN     "role" "Roles" NOT NULL;
