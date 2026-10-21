-- CreateEnum
CREATE TYPE "PaymentConcept" AS ENUM ('FULL_PRICE', 'BALANCE', 'INSTALLMENT');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED', 'PENDING_VALIDATION', 'VALIDATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TransferRejectionReason" AS ENUM ('ILLEGIBLE', 'AMOUNT_MISMATCH', 'NOT_FOUND', 'OTHER');

-- CreateEnum
CREATE TYPE "InstallmentPlanStatus" AS ENUM ('PENDING_ACTIVATION', 'CURRENT', 'PAST_DUE', 'DELINQUENT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('SCHEDULED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "transfer_rejected_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "seat_hold_expires_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "stripe_customer_id" VARCHAR(255);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "enrollment_id" UUID,
    "application_id" UUID,
    "plan_id" UUID,
    "installment_id" UUID,
    "concept" "PaymentConcept" NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount_cents" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL,
    "refunded_cents" INTEGER NOT NULL DEFAULT 0,
    "stripe_checkout_session_id" VARCHAR(255),
    "stripe_payment_intent_id" VARCHAR(255),
    "stripe_charge_id" VARCHAR(255),
    "stripe_receipt_url" VARCHAR(1000),
    "checkout_url" VARCHAR(2000),
    "checkout_expires_at" TIMESTAMPTZ(3),
    "card_brand" VARCHAR(30),
    "card_last4" VARCHAR(4),
    "failure_code" VARCHAR(100),
    "failure_message" VARCHAR(500),
    "transfer_reference" VARCHAR(40),
    "declared_amount_cents" INTEGER,
    "declared_paid_on" DATE,
    "tracking_key" VARCHAR(40),
    "proof_file_key" VARCHAR(500),
    "proof_file_name" VARCHAR(255),
    "proof_mime_type" VARCHAR(120),
    "proof_size_bytes" INTEGER,
    "received_amount_cents" INTEGER,
    "received_on" DATE,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "rejection_reason" "TransferRejectionReason",
    "rejection_note" VARCHAR(500),
    "submitted_at" TIMESTAMPTZ(3),
    "paid_at" TIMESTAMPTZ(3),
    "failed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "refunded_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installment_plans" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "enrollment_id" UUID,
    "application_id" UUID,
    "concept" "PaymentConcept" NOT NULL,
    "status" "InstallmentPlanStatus" NOT NULL DEFAULT 'PENDING_ACTIVATION',
    "currency" "Currency" NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "installment_count" INTEGER NOT NULL,
    "stripe_customer_id" VARCHAR(255),
    "stripe_payment_method_id" VARCHAR(255),
    "card_brand" VARCHAR(30),
    "card_last4" VARCHAR(4),
    "card_exp_month" INTEGER,
    "card_exp_year" INTEGER,
    "auto_debit_authorized_at" TIMESTAMPTZ(3) NOT NULL,
    "activated_at" TIMESTAMPTZ(3),
    "failed_since" TIMESTAMPTZ(3),
    "delinquent_at" TIMESTAMPTZ(3),
    "access_suspended_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "cancel_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "installment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installments" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "due_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMPTZ(3),
    "next_retry_at" TIMESTAMPTZ(3),
    "processing_since" TIMESTAMPTZ(3),
    "paid_at" TIMESTAMPTZ(3),
    "failed_at" TIMESTAMPTZ(3),
    "failure_message" VARCHAR(500),
    "upcoming_notified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_events" (
    "id" VARCHAR(255) NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "stripe_created_at" TIMESTAMPTZ(3) NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),
    "error" TEXT,

    CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moodle_roster_entries" (
    "id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "linked_user_id" UUID,
    "linked_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moodle_roster_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moodle_access_codes" (
    "id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "code_hash" VARCHAR(64) NOT NULL,
    "code_hint" VARCHAR(4) NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "used_by_id" UUID,
    "used_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moodle_access_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_number_key" ON "payments"("number");

-- CreateIndex
CREATE UNIQUE INDEX "payments_installment_id_key" ON "payments"("installment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripe_checkout_session_id_key" ON "payments"("stripe_checkout_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripe_payment_intent_id_key" ON "payments"("stripe_payment_intent_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_proof_file_key_key" ON "payments"("proof_file_key");

-- CreateIndex
CREATE INDEX "payments_user_id_created_at_idx" ON "payments"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "payments_offer_id_status_idx" ON "payments"("offer_id", "status");

-- CreateIndex
CREATE INDEX "payments_application_id_idx" ON "payments"("application_id");

-- CreateIndex
CREATE INDEX "payments_status_checkout_expires_at_idx" ON "payments"("status", "checkout_expires_at");

-- CreateIndex
CREATE INDEX "installment_plans_user_id_status_idx" ON "installment_plans"("user_id", "status");

-- CreateIndex
CREATE INDEX "installment_plans_status_failed_since_idx" ON "installment_plans"("status", "failed_since");

-- CreateIndex
CREATE INDEX "installments_status_due_at_idx" ON "installments"("status", "due_at");

-- CreateIndex
CREATE INDEX "installments_status_next_retry_at_idx" ON "installments"("status", "next_retry_at");

-- CreateIndex
CREATE UNIQUE INDEX "installments_plan_id_sequence_key" ON "installments"("plan_id", "sequence");

-- CreateIndex
CREATE INDEX "stripe_events_received_at_idx" ON "stripe_events"("received_at");

-- CreateIndex
CREATE INDEX "moodle_roster_entries_email_idx" ON "moodle_roster_entries"("email");

-- CreateIndex
CREATE UNIQUE INDEX "moodle_roster_entries_offer_id_email_key" ON "moodle_roster_entries"("offer_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "moodle_access_codes_code_hash_key" ON "moodle_access_codes"("code_hash");

-- CreateIndex
CREATE INDEX "moodle_access_codes_offer_id_idx" ON "moodle_access_codes"("offer_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_customer_id_key" ON "users"("stripe_customer_id");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "installment_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "installment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moodle_roster_entries" ADD CONSTRAINT "moodle_roster_entries_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moodle_roster_entries" ADD CONSTRAINT "moodle_roster_entries_linked_user_id_fkey" FOREIGN KEY ("linked_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moodle_roster_entries" ADD CONSTRAINT "moodle_roster_entries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moodle_access_codes" ADD CONSTRAINT "moodle_access_codes_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moodle_access_codes" ADD CONSTRAINT "moodle_access_codes_used_by_id_fkey" FOREIGN KEY ("used_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moodle_access_codes" ADD CONSTRAINT "moodle_access_codes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
