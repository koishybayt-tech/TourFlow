-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "remindedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "telegramCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramCode_key" ON "User"("telegramCode");

