-- AlterTable
ALTER TABLE "users" ADD COLUMN     "token_version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "favorites_user_id_created_at_idx" ON "favorites"("user_id", "created_at" DESC);
