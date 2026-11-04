-- CreateTable
CREATE TABLE "NightRoom" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "hostId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LOBBY',
    "mediaType" TEXT NOT NULL DEFAULT 'movie',
    "genre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "NightRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NightMember" (
    "id" SERIAL NOT NULL,
    "roomId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NightMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NightCard" (
    "id" SERIAL NOT NULL,
    "roomId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "mediaType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "posterPath" TEXT,
    "overview" TEXT,
    "year" TEXT,
    "rating" DOUBLE PRECISION,
    "matchedAt" TIMESTAMP(3),

    CONSTRAINT "NightCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NightSwipe" (
    "id" SERIAL NOT NULL,
    "roomId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "mediaType" TEXT NOT NULL,
    "liked" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NightSwipe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NightRoom_code_key" ON "NightRoom"("code");

-- CreateIndex
CREATE INDEX "NightRoom_hostId_status_idx" ON "NightRoom"("hostId", "status");

-- CreateIndex
CREATE INDEX "NightRoom_createdAt_idx" ON "NightRoom"("createdAt");

-- CreateIndex
CREATE INDEX "NightMember_userId_idx" ON "NightMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NightMember_roomId_userId_key" ON "NightMember"("roomId", "userId");

-- CreateIndex
CREATE INDEX "NightCard_roomId_position_idx" ON "NightCard"("roomId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "NightCard_roomId_tmdbId_mediaType_key" ON "NightCard"("roomId", "tmdbId", "mediaType");

-- CreateIndex
CREATE INDEX "NightSwipe_roomId_tmdbId_mediaType_idx" ON "NightSwipe"("roomId", "tmdbId", "mediaType");

-- CreateIndex
CREATE INDEX "NightSwipe_userId_idx" ON "NightSwipe"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NightSwipe_roomId_userId_tmdbId_mediaType_key" ON "NightSwipe"("roomId", "userId", "tmdbId", "mediaType");

-- AddForeignKey
ALTER TABLE "NightRoom" ADD CONSTRAINT "NightRoom_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightMember" ADD CONSTRAINT "NightMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "NightRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightMember" ADD CONSTRAINT "NightMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightCard" ADD CONSTRAINT "NightCard_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "NightRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightSwipe" ADD CONSTRAINT "NightSwipe_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "NightRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightSwipe" ADD CONSTRAINT "NightSwipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
