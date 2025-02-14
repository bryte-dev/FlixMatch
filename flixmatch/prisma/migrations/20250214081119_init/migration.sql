/*
  Warnings:

  - You are about to drop the column `userId` on the `Watchlist` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Watchlist" DROP CONSTRAINT "Watchlist_userId_fkey";

-- DropIndex
DROP INDEX "Watchlist_userId_key";

-- AlterTable
ALTER TABLE "Watchlist" DROP COLUMN "userId";
