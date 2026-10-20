-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PARTICIPANT', 'SUPER_ADMIN', 'ACADEMIC_COORDINATOR', 'REVIEW_COMMITTEE', 'REVIEW_DECIDER', 'FOLLOW_UP', 'FINANCE');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "ContactSubject" AS ENUM ('SCHOOL', 'DESIGN_CONSULTING', 'REGENERATIVE_TECH_HAWA', 'SCHOLARSHIPS_CALLS', 'OTHER');

-- CreateEnum
CREATE TYPE "ContactOrigin" AS ENUM ('CONTACT_PAGE', 'LANDING', 'DESIGN_CONSULTING_PAGE', 'REGENERATIVE_TECH_PAGE', 'ABOUT_PAGE');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('NEW');

-- CreateEnum
CREATE TYPE "ContactProjectType" AS ENUM ('HOUSEHOLD', 'COMMERCIAL', 'COLLECTIVE', 'PRODUCTIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "ContactService" AS ENUM ('WASTEWATER_TREATMENT_DESIGN', 'RAINWATER_HARVESTING_DESIGN', 'INFILTRATION_REHYDRATION_DESIGN', 'WATER_RESILIENCE_DIAGNOSTICS', 'TECHNOLOGY_IMPLEMENTATION_ADVICE', 'NOT_SURE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "username" VARCHAR(30) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phone_country_code" VARCHAR(5) NOT NULL,
    "phone_number" VARCHAR(15) NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "division_id" UUID,
    "division_name" VARCHAR(100) NOT NULL,
    "municipality_id" UUID,
    "municipality_name" VARCHAR(100) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "roles" "Role"[] DEFAULT ARRAY['PARTICIPANT']::"Role"[],
    "email_verified_at" TIMESTAMPTZ(3),
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "login_locked_until" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "verified_at" TIMESTAMPTZ(3),
    "reset_token_hash" TEXT,
    "reset_token_expires_at" TIMESTAMPTZ(3),
    "consumed_at" TIMESTAMPTZ(3),
    "invalidated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "remember_me" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "replaced_by_id" UUID,
    "user_agent" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "countries" (
    "code" CHAR(2) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "phone_code" VARCHAR(5) NOT NULL,
    "phone_min_length" INTEGER NOT NULL,
    "phone_max_length" INTEGER NOT NULL,
    "division_label" VARCHAR(40) NOT NULL,
    "municipality_label" VARCHAR(40) NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "admin_divisions" (
    "id" UUID NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "admin_divisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "municipalities" (
    "id" UUID NOT NULL,
    "division_id" UUID NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "municipalities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "organization" VARCHAR(150),
    "phone_country_code" VARCHAR(5),
    "phone_number" VARCHAR(15),
    "subject" "ContactSubject" NOT NULL,
    "project_type" "ContactProjectType",
    "project_location" VARCHAR(150),
    "service" "ContactService",
    "message" VARCHAR(2000) NOT NULL,
    "privacy_accepted_at" TIMESTAMPTZ(3) NOT NULL,
    "origin" "ContactOrigin" NOT NULL,
    "status" "ContactStatus" NOT NULL DEFAULT 'NEW',
    "ip_hash" VARCHAR(64),
    "user_agent" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "otp_codes_reset_token_hash_key" ON "otp_codes"("reset_token_hash");

-- CreateIndex
CREATE INDEX "otp_codes_user_id_purpose_created_at_idx" ON "otp_codes"("user_id", "purpose", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_divisions_country_code_code_key" ON "admin_divisions"("country_code", "code");

-- CreateIndex
CREATE UNIQUE INDEX "municipalities_division_id_code_key" ON "municipalities"("division_id", "code");

-- CreateIndex
CREATE INDEX "contact_messages_created_at_idx" ON "contact_messages"("created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "admin_divisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_municipality_id_fkey" FOREIGN KEY ("municipality_id") REFERENCES "municipalities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_divisions" ADD CONSTRAINT "admin_divisions_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "municipalities" ADD CONSTRAINT "municipalities_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "admin_divisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
