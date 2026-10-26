-- DropForeignKey
ALTER TABLE "favorites" DROP CONSTRAINT "favorites_tmdb_id_fkey";

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_tmdb_id_fkey" FOREIGN KEY ("tmdb_id") REFERENCES "movies"("tmdb_id") ON DELETE RESTRICT ON UPDATE RESTRICT;
