-- Suppression de compte : les listes et avis de l'utilisateur disparaissent avec lui
-- (filet de sécurité en base). L'API supprime explicitement les fils de réponses sous
-- ses avis avant, pour ne pas laisser de réponses orphelines (parentId -> NULL).
-- Index userId/movieId : accélèrent les listes, le fil d'activité et les avis par titre.

ALTER TABLE "Watchlist" DROP CONSTRAINT "Watchlist_userId_fkey";
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Review" DROP CONSTRAINT "Review_userId_fkey";
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Watchlist_userId_idx" ON "Watchlist"("userId");
CREATE INDEX IF NOT EXISTS "Review_userId_idx" ON "Review"("userId");
CREATE INDEX IF NOT EXISTS "Review_movieId_idx" ON "Review"("movieId");
