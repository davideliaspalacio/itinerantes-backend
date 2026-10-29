-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ContactStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "ContactStatus" ADD VALUE 'ANSWERED';
ALTER TYPE "ContactStatus" ADD VALUE 'ARCHIVED';

-- AlterTable
ALTER TABLE "contact_messages" ADD COLUMN     "handled_at" TIMESTAMPTZ(3),
ADD COLUMN     "handled_by_id" UUID,
ADD COLUMN     "internal_note" VARCHAR(2000);

-- CreateIndex
CREATE INDEX "contact_messages_status_created_at_idx" ON "contact_messages"("status", "created_at");

-- AddForeignKey
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_handled_by_id_fkey" FOREIGN KEY ("handled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
