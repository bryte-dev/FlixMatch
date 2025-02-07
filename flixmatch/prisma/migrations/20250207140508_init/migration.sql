/*
  Warnings:

  - You are about to drop the column `rating` on the `Watchlist` table. All the data in the column will be lost.
  - The `status` column on the `Watchlist` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Watchlist" DROP COLUMN "rating",
DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'WATCHLIST';
