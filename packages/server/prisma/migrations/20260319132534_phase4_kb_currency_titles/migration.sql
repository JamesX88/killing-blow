-- AlterTable
ALTER TABLE "User" ADD COLUMN     "equippedTitle" TEXT,
ADD COLUMN     "kbBalance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ownedTitles" TEXT NOT NULL DEFAULT '[]';
