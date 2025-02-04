/*
  Warnings:

  - You are about to drop the column `userId` on the `Watchlist` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[movieId]` on the table `Watchlist` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Watchlist" DROP CONSTRAINT "Watchlist_userId_fkey";

-- AlterTable
ALTER TABLE "Watchlist" DROP COLUMN "userId";

-- CreateIndex
CREATE UNIQUE INDEX "Watchlist_movieId_key" ON "Watchlist"("movieId");
