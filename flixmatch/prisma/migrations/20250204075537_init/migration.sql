/*
  Warnings:

  - The `status` column on the `Watchlist` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "WatchlistStatus" AS ENUM ('WATCHLIST', 'SEEN', 'JUNK');

-- AlterTable
ALTER TABLE "Watchlist" ADD COLUMN     "isFavorite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rating" INTEGER,
DROP COLUMN "status",
ADD COLUMN     "status" "WatchlistStatus" NOT NULL DEFAULT 'WATCHLIST';
