-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'COMPLETED', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EnrollmentOrigin" AS ENUM ('NAS', 'MOODLE');

-- CreateEnum
CREATE TYPE "EnrollmentSource" AS ENUM ('FREE_SIGNUP', 'PAYMENT', 'INSTALLMENTS', 'SCHOLARSHIP', 'OPEN_CALL', 'MOODLE_LIST', 'MOODLE_ACCESS_CODE', 'MANUAL');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('PARTICIPANT', 'MANUAL');

-- CreateEnum
CREATE TYPE "LibraryResourceType" AS ENUM ('PDF', 'ARTICLE', 'BOOK', 'VIDEO', 'AUDIO', 'EXTERNAL', 'COURSE_MATERIAL');

-- CreateEnum
CREATE TYPE "LibraryAudience" AS ENUM ('ALL_REGISTERED', 'OFFER_ENROLLED');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('TRAINING', 'APPLICATIONS', 'PAYMENTS', 'GENERAL');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('NORMAL', 'HIGH');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ENROLLMENT_CONFIRMED', 'ATTENDANCE_OPEN', 'WHATSAPP_GROUP_AVAILABLE', 'MATERIAL_PUBLISHED', 'RECORDING_PUBLISHED', 'SESSION_RESCHEDULED', 'SESSION_CANCELLED', 'MOODLE_ENROLLMENT_LINKED', 'APPLICATION_SUBMITTED', 'APPLICATION_STATUS_CHANGED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_REMINDER', 'SCHOLARSHIP_APPROVED', 'APPLICATION_EXPIRED', 'PAYMENT_CONFIRMED', 'BALANCE_DUE_REMINDER', 'INSTALLMENT_UPCOMING', 'INSTALLMENT_PAID', 'INSTALLMENT_FAILED', 'PLAN_DELINQUENT', 'TRANSFER_VALIDATED', 'TRANSFER_REJECTED', 'GENERAL');

-- CreateEnum
CREATE TYPE "NotificationEmailStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "module_resources" ADD COLUMN     "library_resource_id" UUID;

-- AlterTable
ALTER TABLE "offer_modules" ADD COLUMN     "teacher_id" UUID;

-- AlterTable
ALTER TABLE "offer_sessions" ADD COLUMN     "attendance_notified_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "offers" ADD COLUMN     "classroom_welcome" TEXT,
ADD COLUMN     "final_project_guidelines" TEXT,
ADD COLUMN     "final_project_submission_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsapp_notified_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "origin" "EnrollmentOrigin" NOT NULL DEFAULT 'NAS',
    "source" "EnrollmentSource" NOT NULL,
    "application_id" UUID,
    "activated_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "suspended_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "status_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_attendances" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "source" "AttendanceSource" NOT NULL DEFAULT 'PARTICIPANT',
    "comment" VARCHAR(500),
    "registered_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by_id" UUID,
    "manual_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "final_project_submissions" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "file_key" VARCHAR(500) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "final_project_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_resources" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "type" "LibraryResourceType" NOT NULL,
    "author" VARCHAR(200),
    "keywords" TEXT[],
    "thumbnail_key" VARCHAR(500),
    "file_key" VARCHAR(500),
    "file_name" VARCHAR(255),
    "mime_type" VARCHAR(120),
    "size_bytes" INTEGER,
    "url" VARCHAR(1000),
    "audience" "LibraryAudience" NOT NULL DEFAULT 'ALL_REGISTERED',
    "offer_id" UUID,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "ContentVisibility" NOT NULL DEFAULT 'HIDDEN',
    "publish_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "library_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "action_label" VARCHAR(80),
    "action_path" VARCHAR(500),
    "data" JSONB,
    "dedupe_key" VARCHAR(200),
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(3),
    "resolved_at" TIMESTAMPTZ(3),
    "email_status" "NotificationEmailStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "email_sent_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_application_id_key" ON "enrollments"("application_id");

-- CreateIndex
CREATE INDEX "enrollments_offer_id_status_idx" ON "enrollments"("offer_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_user_id_offer_id_key" ON "enrollments"("user_id", "offer_id");

-- CreateIndex
CREATE INDEX "session_attendances_user_id_idx" ON "session_attendances"("user_id");

-- CreateIndex
CREATE INDEX "session_attendances_enrollment_id_idx" ON "session_attendances"("enrollment_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_attendances_session_id_user_id_key" ON "session_attendances"("session_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "final_project_submissions_enrollment_id_key" ON "final_project_submissions"("enrollment_id");

-- CreateIndex
CREATE INDEX "final_project_submissions_offer_id_idx" ON "final_project_submissions"("offer_id");

-- CreateIndex
CREATE UNIQUE INDEX "library_resources_slug_key" ON "library_resources"("slug");

-- CreateIndex
CREATE INDEX "library_resources_visibility_type_idx" ON "library_resources"("visibility", "type");

-- CreateIndex
CREATE INDEX "library_resources_offer_id_idx" ON "library_resources"("offer_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_pinned_created_at_idx" ON "notifications"("user_id", "pinned", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_dedupe_key_key" ON "notifications"("user_id", "dedupe_key");

-- AddForeignKey
ALTER TABLE "offer_modules" ADD CONSTRAINT "offer_modules_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_resources" ADD CONSTRAINT "module_resources_library_resource_id_fkey" FOREIGN KEY ("library_resource_id") REFERENCES "library_resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_attendances" ADD CONSTRAINT "session_attendances_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "offer_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_attendances" ADD CONSTRAINT "session_attendances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_attendances" ADD CONSTRAINT "session_attendances_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_attendances" ADD CONSTRAINT "session_attendances_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_project_submissions" ADD CONSTRAINT "final_project_submissions_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_project_submissions" ADD CONSTRAINT "final_project_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final_project_submissions" ADD CONSTRAINT "final_project_submissions_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_resources" ADD CONSTRAINT "library_resources_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
