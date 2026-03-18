-- CreateTable
CREATE TABLE "Boss" (
    "id" TEXT NOT NULL,
    "bossNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "maxHp" INTEGER NOT NULL,
    "spawnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "defeatedAt" TIMESTAMP(3),
    "winnerId" TEXT,

    CONSTRAINT "Boss_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FightContribution" (
    "id" TEXT NOT NULL,
    "bossId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "damageDealt" INTEGER NOT NULL,

    CONSTRAINT "FightContribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Boss_bossNumber_key" ON "Boss"("bossNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FightContribution_bossId_userId_key" ON "FightContribution"("bossId", "userId");

-- AddForeignKey
ALTER TABLE "FightContribution" ADD CONSTRAINT "FightContribution_bossId_fkey" FOREIGN KEY ("bossId") REFERENCES "Boss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FightContribution" ADD CONSTRAINT "FightContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
