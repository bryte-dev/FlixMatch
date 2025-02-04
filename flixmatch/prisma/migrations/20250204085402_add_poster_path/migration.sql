/*
  Warnings:

  - Added the required column `poster_path` to the `Movie` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Movie" ADD COLUMN     "poster_path" TEXT NOT NULL;
