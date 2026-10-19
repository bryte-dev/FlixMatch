-- TMDB réutilise les mêmes identifiants pour les films et les séries (ex. 1399).
-- L'ancienne contrainte unique sur tmdb_id seul faisait pointer une série importée
-- vers le film de même id : l'unicité porte désormais sur (tmdb_id, media_type).

DROP INDEX IF EXISTS "Movie_tmdb_id_key";

CREATE UNIQUE INDEX "Movie_tmdb_id_media_type_key" ON "Movie"("tmdb_id", "media_type");
CREATE INDEX "Movie_tmdb_id_idx" ON "Movie"("tmdb_id");
