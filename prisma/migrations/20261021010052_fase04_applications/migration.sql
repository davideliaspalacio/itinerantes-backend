-- CreateEnum
CREATE TYPE "ApplicationKind" AS ENUM ('SCHOLARSHIP', 'OPEN_CALL');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'INTERVIEW_SCHEDULED', 'APPROVED_PENDING_PAYMENT', 'APPROVED_PENDING_CONFIRMATION', 'ENROLLED', 'NOT_SELECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ApplicationActorType" AS ENUM ('PARTICIPANT', 'STAFF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ApplicationDocumentKind" AS ENUM ('EVIDENCE');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "open_calls_seen_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "kind" "ApplicationKind" NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "status_changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applicant_name" VARCHAR(120) NOT NULL,
    "applicant_email" VARCHAR(254) NOT NULL,
    "phone_country_code" VARCHAR(5) NOT NULL,
    "phone_number" VARCHAR(15) NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "division_name" VARCHAR(100) NOT NULL,
    "municipality_name" VARCHAR(100) NOT NULL,
    "age" INTEGER,
    "partner_code" VARCHAR(40),
    "organization" VARCHAR(150),
    "organization_role" VARCHAR(120),
    "requested_level" "ScholarshipLevel",
    "intent_letter" TEXT,
    "eligibility_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "experience" TEXT,
    "motivation" TEXT,
    "can_travel" BOOLEAN,
    "evidence_links" TEXT[],
    "terms_accepted_at" TIMESTAMPTZ(3),
    "currency" "Currency",
    "original_amount_cents" INTEGER,
    "assigned_level" "ScholarshipLevel",
    "assigned_percent" INTEGER,
    "balance_cents" INTEGER,
    "decided_by_id" UUID,
    "decision_note" VARCHAR(1000),
    "response_due_at" TIMESTAMPTZ(3),
    "submitted_at" TIMESTAMPTZ(3),
    "review_started_at" TIMESTAMPTZ(3),
    "decided_at" TIMESTAMPTZ(3),
    "enrolled_at" TIMESTAMPTZ(3),
    "expired_at" TIMESTAMPTZ(3),
    "payment_started_at" TIMESTAMPTZ(3),
    "pending_transfer_since" TIMESTAMPTZ(3),
    "due_reminder_sent_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_documents" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "ApplicationDocumentKind" NOT NULL DEFAULT 'EVIDENCE',
    "file_key" VARCHAR(500) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_status_events" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "from_status" "ApplicationStatus",
    "to_status" "ApplicationStatus" NOT NULL,
    "actor_type" "ApplicationActorType" NOT NULL,
    "actor_id" UUID,
    "note" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_interviews" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "join_url" VARCHAR(1000) NOT NULL,
    "status" "InterviewStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduled_by_id" UUID,
    "completed_at" TIMESTAMPTZ(3),
    "reminder_sent_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "application_interviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "applications_number_key" ON "applications"("number");

-- CreateIndex
CREATE INDEX "applications_offer_id_status_idx" ON "applications"("offer_id", "status");

-- CreateIndex
CREATE INDEX "applications_status_response_due_at_idx" ON "applications"("status", "response_due_at");

-- CreateIndex
CREATE INDEX "applications_user_id_kind_idx" ON "applications"("user_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "applications_user_id_offer_id_key" ON "applications"("user_id", "offer_id");

-- CreateIndex
CREATE UNIQUE INDEX "application_documents_file_key_key" ON "application_documents"("file_key");

-- CreateIndex
CREATE INDEX "application_documents_application_id_idx" ON "application_documents"("application_id");

-- CreateIndex
CREATE INDEX "application_status_events_application_id_created_at_idx" ON "application_status_events"("application_id", "created_at");

-- CreateIndex
CREATE INDEX "application_interviews_application_id_idx" ON "application_interviews"("application_id");

-- CreateIndex
CREATE INDEX "application_interviews_status_starts_at_idx" ON "application_interviews"("status", "starts_at");

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_status_events" ADD CONSTRAINT "application_status_events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_status_events" ADD CONSTRAINT "application_status_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_interviews" ADD CONSTRAINT "application_interviews_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_interviews" ADD CONSTRAINT "application_interviews_scheduled_by_id_fkey" FOREIGN KEY ("scheduled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
