-- CreateEnum
CREATE TYPE "OfferType" AS ENUM ('DIPLOMA', 'COURSE', 'WORKSHOP', 'EVENT', 'OPEN_CALL');

-- CreateEnum
CREATE TYPE "OfferModality" AS ENUM ('ONLINE_LIVE', 'IN_PERSON');

-- CreateEnum
CREATE TYPE "OfferOrigin" AS ENUM ('NAS', 'MOODLE');

-- CreateEnum
CREATE TYPE "OfferPublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('MXN', 'USD');

-- CreateEnum
CREATE TYPE "ScholarshipLevel" AS ENUM ('AGUA_VIVA', 'RIOS_VIVOS', 'AGUAS_LIBRES', 'CENOTES_VIVOS', 'SPECIAL');

-- CreateEnum
CREATE TYPE "CalendarCategory" AS ENUM ('TRAINING', 'TERRITORY', 'COMMUNITY', 'EVENTS', 'IMPORTANT_DATES');

-- CreateEnum
CREATE TYPE "PublicTopic" AS ENUM ('ECOTECH_WATER_DIPLOMA', 'ECOPEDAGOGIES_DIPLOMA', 'WATER_APPRENTICES_SCHOOL', 'WATER_TREATMENT_SYSTEMS_INTRO', 'CONSTRUCTED_WETLANDS', 'DRY_TOILETS', 'WATER_HARVESTING', 'TRAVELING_WATER_LABS', 'TERRITORIAL_PRACTICES', 'FIELD_VISITS');

-- CreateEnum
CREATE TYPE "ContentVisibility" AS ENUM ('HIDDEN', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ModuleResourceType" AS ENUM ('PRESENTATION', 'PRE_READING', 'ACTIVITY');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CalendarAudience" AS ENUM ('ALL_REGISTERED', 'OFFER_ENROLLED');

-- CreateEnum
CREATE TYPE "CalendarEventKind" AS ENUM ('MANUAL', 'ENROLLMENT_OPENS', 'ENROLLMENT_CLOSES', 'OFFER_STARTS', 'SCHOLARSHIP_DEADLINE', 'FINAL_PROJECT');

-- CreateTable
CREATE TABLE "offers" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "type" "OfferType" NOT NULL,
    "modality" "OfferModality" NOT NULL,
    "origin" "OfferOrigin" NOT NULL DEFAULT 'NAS',
    "publication_status" "OfferPublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(3),
    "cohort_label" VARCHAR(80),
    "summary" VARCHAR(300) NOT NULL,
    "description" TEXT NOT NULL,
    "learning_outcomes" TEXT[],
    "requirements" TEXT,
    "cover_image_key" VARCHAR(500),
    "carousel_image_keys" TEXT[],
    "public_topic" "PublicTopic",
    "enrollment_opens_at" TIMESTAMPTZ(3),
    "enrollment_closes_at" TIMESTAMPTZ(3),
    "starts_at" TIMESTAMPTZ(3),
    "ends_at" TIMESTAMPTZ(3),
    "final_project_due_at" TIMESTAMPTZ(3),
    "total_minutes" INTEGER,
    "schedule_rule" JSONB,
    "calendar_category" "CalendarCategory" NOT NULL DEFAULT 'TRAINING',
    "venue_name" VARCHAR(160),
    "venue_address" VARCHAR(300),
    "venue_city" VARCHAR(120),
    "venue_maps_url" VARCHAR(500),
    "capacity" INTEGER,
    "is_free" BOOLEAN NOT NULL DEFAULT false,
    "price_mxn_cents" INTEGER,
    "price_usd_cents" INTEGER,
    "installments_enabled" BOOLEAN NOT NULL DEFAULT false,
    "installments_max" INTEGER,
    "moodle_course_url" VARCHAR(500),
    "scholarship_enabled" BOOLEAN NOT NULL DEFAULT false,
    "scholarship_levels" "ScholarshipLevel"[],
    "scholarship_opens_at" TIMESTAMPTZ(3),
    "scholarship_closes_at" TIMESTAMPTZ(3),
    "eligibility_text" TEXT,
    "eligible_country_codes" TEXT[],
    "requires_travel" BOOLEAN NOT NULL DEFAULT false,
    "attendance_window_hours" INTEGER NOT NULL DEFAULT 24,
    "whatsapp_group_url" VARCHAR(500),
    "whatsapp_visible_from" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teachers" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "full_name" VARCHAR(160) NOT NULL,
    "photo_key" VARCHAR(500),
    "bio" TEXT,
    "cv_url" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_teachers" (
    "offer_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "offer_teachers_pkey" PRIMARY KEY ("offer_id","teacher_id")
);

-- CreateTable
CREATE TABLE "offer_modules" (
    "id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "visibility" "ContentVisibility" NOT NULL DEFAULT 'HIDDEN',
    "publish_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "offer_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_resources" (
    "id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "type" "ModuleResourceType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "file_key" VARCHAR(500),
    "file_name" VARCHAR(255),
    "mime_type" VARCHAR(120),
    "size_bytes" INTEGER,
    "url" VARCHAR(1000),
    "activity_due_at" TIMESTAMPTZ(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "visibility" "ContentVisibility" NOT NULL DEFAULT 'HIDDEN',
    "publish_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "module_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_sessions" (
    "id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "module_id" UUID,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "category" "CalendarCategory" NOT NULL DEFAULT 'TRAINING',
    "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "join_url" VARCHAR(1000),
    "host_url" VARCHAR(1000),
    "recording_url" VARCHAR(1000),
    "recording_published_at" TIMESTAMPTZ(3),
    "attendance_window_hours" INTEGER,
    "original_starts_at" TIMESTAMPTZ(3),
    "change_reason" VARCHAR(500),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "offer_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" UUID NOT NULL,
    "kind" "CalendarEventKind" NOT NULL DEFAULT 'MANUAL',
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "category" "CalendarCategory" NOT NULL,
    "audience" "CalendarAudience" NOT NULL DEFAULT 'ALL_REGISTERED',
    "offer_id" UUID,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3),
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "location" VARCHAR(300),
    "join_url" VARCHAR(1000),
    "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "offers_slug_key" ON "offers"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "offers_name_key" ON "offers"("name");

-- CreateIndex
CREATE INDEX "offers_publication_status_starts_at_idx" ON "offers"("publication_status", "starts_at");

-- CreateIndex
CREATE INDEX "offers_public_topic_idx" ON "offers"("public_topic");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_slug_key" ON "teachers"("slug");

-- CreateIndex
CREATE INDEX "offer_teachers_teacher_id_idx" ON "offer_teachers"("teacher_id");

-- CreateIndex
CREATE INDEX "offer_modules_offer_id_position_idx" ON "offer_modules"("offer_id", "position");

-- CreateIndex
CREATE INDEX "module_resources_module_id_type_position_idx" ON "module_resources"("module_id", "type", "position");

-- CreateIndex
CREATE INDEX "offer_sessions_starts_at_idx" ON "offer_sessions"("starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "offer_sessions_offer_id_starts_at_key" ON "offer_sessions"("offer_id", "starts_at");

-- CreateIndex
CREATE INDEX "calendar_events_starts_at_idx" ON "calendar_events"("starts_at");

-- CreateIndex
CREATE INDEX "calendar_events_offer_id_kind_idx" ON "calendar_events"("offer_id", "kind");

-- AddForeignKey
ALTER TABLE "offer_teachers" ADD CONSTRAINT "offer_teachers_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_teachers" ADD CONSTRAINT "offer_teachers_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_modules" ADD CONSTRAINT "offer_modules_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_resources" ADD CONSTRAINT "module_resources_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "offer_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_sessions" ADD CONSTRAINT "offer_sessions_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_sessions" ADD CONSTRAINT "offer_sessions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "offer_modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
