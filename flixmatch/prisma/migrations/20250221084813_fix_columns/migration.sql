/*
  Warnings:

  - You are about to drop the column `createdAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Watchlist` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[movieId]` on the table `Watchlist` will be added. If there are existing duplicate values, this will fail.
  - Made the column `rating` on table `Watchlist` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Watchlist" DROP CONSTRAINT "Watchlist_userId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "createdAt";

-- AlterTable
ALTER TABLE "Watchlist" DROP COLUMN "userId",
ALTER COLUMN "rating" SET NOT NULL,
ALTER COLUMN "rating" SET DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Watchlist_movieId_key" ON "Watchlist"("movieId");
