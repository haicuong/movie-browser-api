/*
  Warnings:

  - The primary key for the `favorites` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `favorites` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "favorites_user_id_tmdb_id_key";

-- AlterTable
ALTER TABLE "favorites" DROP CONSTRAINT "favorites_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "favorites_pkey" PRIMARY KEY ("user_id", "tmdb_id");
