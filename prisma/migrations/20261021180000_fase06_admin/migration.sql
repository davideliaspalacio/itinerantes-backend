-- CreateEnum
CREATE TYPE "EvaluationRecommendation" AS ENUM ('APPROVE', 'NOT_SELECT', 'UNSURE');

-- CreateEnum
CREATE TYPE "FollowUpNoteKind" AS ENUM ('NOTE', 'REMINDER_SENT', 'WHATSAPP_CONTACT');

-- CreateEnum
CREATE TYPE "FollowUpOutcome" AS ENUM ('NO_RESPONSE', 'WILL_PAY_SOON', 'REQUESTS_INSTALLMENTS', 'WITHDRAWS');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- AlterTable
ALTER TABLE "module_resources" ADD COLUMN     "notify_enrollees" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "published_notified_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "offer_modules" ADD COLUMN     "notify_enrollees" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "published_notified_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_email" VARCHAR(254) NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "entity_type" VARCHAR(60) NOT NULL,
    "entity_id" VARCHAR(64),
    "summary" VARCHAR(500) NOT NULL,
    "changes" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_evaluations" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "evaluator_id" UUID NOT NULL,
    "recommendation" "EvaluationRecommendation" NOT NULL,
    "suggested_level" "ScholarshipLevel",
    "comment" VARCHAR(2000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "application_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_follow_up_notes" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "author_id" UUID,
    "kind" "FollowUpNoteKind" NOT NULL DEFAULT 'NOTE',
    "outcome" "FollowUpOutcome",
    "body" VARCHAR(1000) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_follow_up_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_refunds" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "reason" VARCHAR(500) NOT NULL,
    "stripe_refund_id" VARCHAR(255),
    "failure_message" VARCHAR(500),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_audit_logs_entity_type_entity_id_created_at_idx" ON "admin_audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_actor_id_created_at_idx" ON "admin_audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "application_evaluations_application_id_evaluator_id_key" ON "application_evaluations"("application_id", "evaluator_id");

-- CreateIndex
CREATE INDEX "application_follow_up_notes_application_id_created_at_idx" ON "application_follow_up_notes"("application_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_refunds_stripe_refund_id_key" ON "payment_refunds"("stripe_refund_id");

-- CreateIndex
CREATE INDEX "payment_refunds_payment_id_idx" ON "payment_refunds"("payment_id");

-- CreateIndex
CREATE INDEX "payment_refunds_created_at_idx" ON "payment_refunds"("created_at");

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_evaluations" ADD CONSTRAINT "application_evaluations_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_evaluations" ADD CONSTRAINT "application_evaluations_evaluator_id_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_follow_up_notes" ADD CONSTRAINT "application_follow_up_notes_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_follow_up_notes" ADD CONSTRAINT "application_follow_up_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Contenido existente: se considera ya notificado (el job de publicación programada solo avisa de lo
-- que se publique desde el panel a partir de esta fase).
UPDATE "offer_modules" SET "published_notified_at" = CURRENT_TIMESTAMP;
UPDATE "module_resources" SET "published_notified_at" = CURRENT_TIMESTAMP;
