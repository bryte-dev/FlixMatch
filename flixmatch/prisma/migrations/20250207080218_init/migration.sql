/*
  Warnings:

  - A unique constraint covering the columns `[movieId]` on the table `Watchlist` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Watchlist_movieId_key" ON "Watchlist"("movieId");
