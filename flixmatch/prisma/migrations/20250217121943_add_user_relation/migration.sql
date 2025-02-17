/*
  Warnings:

  - Added the required column `userId` to the `Watchlist` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Watchlist_movieId_key";

-- AlterTable
ALTER TABLE "Watchlist" ADD COLUMN     "userId" INTEGER NOT NULL,
ALTER COLUMN "rating" DROP NOT NULL,
ALTER COLUMN "rating" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
