-- CreateTable
CREATE TABLE "EpisodeWatch" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tmdbSeriesId" INTEGER NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "tmdbEpisodeId" INTEGER,
    "name" TEXT,
    "runtime" INTEGER,
    "watchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpisodeWatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EpisodeWatch_userId_tmdbSeriesId_idx" ON "EpisodeWatch"("userId", "tmdbSeriesId");

-- CreateIndex
CREATE UNIQUE INDEX "EpisodeWatch_userId_tmdbSeriesId_seasonNumber_episodeNumber_key" ON "EpisodeWatch"("userId", "tmdbSeriesId", "seasonNumber", "episodeNumber");

-- AddForeignKey
ALTER TABLE "EpisodeWatch" ADD CONSTRAINT "EpisodeWatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
