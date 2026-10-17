-- AlterTable
ALTER TABLE "Movie" ADD COLUMN "genreIds" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Watchlist" ADD COLUMN "abandoned" BOOLEAN NOT NULL DEFAULT false;
