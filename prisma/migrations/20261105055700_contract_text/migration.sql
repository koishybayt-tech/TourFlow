-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "bundle" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "pdfKey" TEXT,
ADD COLUMN     "text" TEXT;

-- AlterTable
ALTER TABLE "Signature" ADD COLUMN     "memberId" TEXT;
