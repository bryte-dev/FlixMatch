-- Usernames uniques (insensibles a la casse) et visibilite par section du profil.
-- Les comptes existants gardent leur nom ; les doublons sont renommes (nom_2, nom_3...).

ALTER TABLE "User" ADD COLUMN "usernameKey" TEXT;
ALTER TABLE "User" ADD COLUMN "privacySeen" TEXT NOT NULL DEFAULT 'private';
ALTER TABLE "User" ADD COLUMN "privacyWatchlist" TEXT NOT NULL DEFAULT 'private';
ALTER TABLE "User" ADD COLUMN "privacyTracking" TEXT NOT NULL DEFAULT 'private';

-- Nouveaux comptes : prive par defaut (les comptes existants ne changent pas)
ALTER TABLE "User" ALTER COLUMN "privacyLibrary" SET DEFAULT 'private';
ALTER TABLE "User" ALTER COLUMN "privacyActivity" SET DEFAULT 'private';

UPDATE "User" SET "username" = NULLIF(BTRIM("username"), '') WHERE "username" IS NOT NULL;

-- Le plus ancien compte garde le nom ; les suivants prennent le suffixe _<rang>
WITH ranked AS (
  SELECT "id", "username", ROW_NUMBER() OVER (PARTITION BY LOWER("username") ORDER BY "id") AS rn
  FROM "User" WHERE "username" IS NOT NULL
)
UPDATE "User" u SET "username" = LEFT(r."username", 25) || '_' || r.rn
FROM ranked r WHERE u."id" = r."id" AND r.rn > 1;

-- Collision residuelle (ex. un compte deja nomme "nom_2") : suffixe base sur l'id, unique par construction
DO $$
DECLARE i INT := 0;
BEGIN
  WHILE i < 5 AND EXISTS (SELECT 1 FROM "User" WHERE "username" IS NOT NULL GROUP BY LOWER("username") HAVING COUNT(*) > 1) LOOP
    UPDATE "User" u SET "username" = LEFT(u."username", 20) || '_' || u."id"
    WHERE u."id" IN (
      SELECT "id" FROM (
        SELECT "id", ROW_NUMBER() OVER (PARTITION BY LOWER("username") ORDER BY "id") AS rn
        FROM "User" WHERE "username" IS NOT NULL
      ) d WHERE d.rn > 1
    );
    i := i + 1;
  END LOOP;
END $$;

UPDATE "User" SET "usernameKey" = LOWER("username") WHERE "username" IS NOT NULL;

CREATE UNIQUE INDEX "User_usernameKey_key" ON "User"("usernameKey");
