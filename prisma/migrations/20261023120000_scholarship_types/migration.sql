-- Becas parametrizables: el enum "ScholarshipLevel" (niveles fijos con porcentajes en código) se
-- reemplaza por la tabla "scholarship_types" (administrable desde el panel) y la tabla puente
-- "offer_scholarship_types" (tipos habilitados por oferta, con rango propio opcional).
-- Migra los datos existentes: ofertas, postulaciones (solicitado/asignado) y evaluaciones.

-- 1) Tablas nuevas -------------------------------------------------------------------------------

-- CreateTable
CREATE TABLE "scholarship_types" (
    "id" UUID NOT NULL,
    "key" VARCHAR(40) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(500),
    "min_percent" INTEGER NOT NULL,
    "max_percent" INTEGER NOT NULL,
    "requires_interview" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "scholarship_types_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "scholarship_types_percent_range_check"
        CHECK ("min_percent" >= 1 AND "min_percent" <= "max_percent" AND "max_percent" <= 100)
);

-- CreateTable
CREATE TABLE "offer_scholarship_types" (
    "offer_id" UUID NOT NULL,
    "scholarship_type_id" UUID NOT NULL,
    "min_percent" INTEGER,
    "max_percent" INTEGER,
    "sort_order" INTEGER,

    CONSTRAINT "offer_scholarship_types_pkey" PRIMARY KEY ("offer_id","scholarship_type_id"),
    CONSTRAINT "offer_scholarship_types_percent_range_check" CHECK (
        ("min_percent" IS NULL OR ("min_percent" >= 1 AND "min_percent" <= 100)) AND
        ("max_percent" IS NULL OR ("max_percent" >= 1 AND "max_percent" <= 100)) AND
        ("min_percent" IS NULL OR "max_percent" IS NULL OR "min_percent" <= "max_percent")
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "scholarship_types_key_key" ON "scholarship_types"("key");

-- CreateIndex
CREATE INDEX "scholarship_types_active_sort_order_idx" ON "scholarship_types"("active", "sort_order");

-- CreateIndex
CREATE INDEX "offer_scholarship_types_scholarship_type_id_idx" ON "offer_scholarship_types"("scholarship_type_id");

-- AddForeignKey
ALTER TABLE "offer_scholarship_types" ADD CONSTRAINT "offer_scholarship_types_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_scholarship_types" ADD CONSTRAINT "offer_scholarship_types_scholarship_type_id_fkey" FOREIGN KEY ("scholarship_type_id") REFERENCES "scholarship_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2) Tipos por defecto (los 5 niveles que existían; keys = valores del enum) ---------------------
-- SPECIAL (71–80%) era el único por encima del umbral de entrevista (> 70%).
INSERT INTO "scholarship_types"
    ("id", "key", "name", "min_percent", "max_percent", "requires_interview", "active", "sort_order", "updated_at")
VALUES
    (gen_random_uuid(), 'AGUA_VIVA',     'Agua Viva',     10, 10, false, true, 1, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'RIOS_VIVOS',    'Ríos Vivos',    25, 25, false, true, 2, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'AGUAS_LIBRES',  'Aguas Libres',  50, 50, false, true, 3, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'CENOTES_VIVOS', 'Cenotes Vivos', 70, 70, false, true, 4, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'SPECIAL',       'Beca especial', 71, 80, true,  true, 5, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- 3) Ofertas: offers.scholarship_levels → offer_scholarship_types ------------------------------
INSERT INTO "offer_scholarship_types" ("offer_id", "scholarship_type_id")
SELECT DISTINCT o."id", st."id"
FROM "offers" o
CROSS JOIN LATERAL unnest(o."scholarship_levels") AS lvl("level")
JOIN "scholarship_types" st ON st."key" = lvl."level"::text
ON CONFLICT DO NOTHING;

-- 4) Postulaciones: requested_level / assigned_level → FKs (+ snapshot del nombre asignado) --------
ALTER TABLE "applications"
    ADD COLUMN "requested_scholarship_type_id" UUID,
    ADD COLUMN "assigned_scholarship_type_id" UUID,
    ADD COLUMN "assigned_scholarship_type_name" VARCHAR(80);

UPDATE "applications" a
SET "requested_scholarship_type_id" = st."id"
FROM "scholarship_types" st
WHERE a."requested_level" IS NOT NULL AND st."key" = a."requested_level"::text;

UPDATE "applications" a
SET "assigned_scholarship_type_id" = st."id",
    "assigned_scholarship_type_name" = st."name"
FROM "scholarship_types" st
WHERE a."assigned_level" IS NOT NULL AND st."key" = a."assigned_level"::text;

-- 5) Evaluaciones: suggested_level → FK ----------------------------------------------------------
ALTER TABLE "application_evaluations" ADD COLUMN "suggested_scholarship_type_id" UUID;

UPDATE "application_evaluations" e
SET "suggested_scholarship_type_id" = st."id"
FROM "scholarship_types" st
WHERE e."suggested_level" IS NOT NULL AND st."key" = e."suggested_level"::text;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_requested_scholarship_type_id_fkey" FOREIGN KEY ("requested_scholarship_type_id") REFERENCES "scholarship_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_assigned_scholarship_type_id_fkey" FOREIGN KEY ("assigned_scholarship_type_id") REFERENCES "scholarship_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_evaluations" ADD CONSTRAINT "application_evaluations_suggested_scholarship_type_id_fkey" FOREIGN KEY ("suggested_scholarship_type_id") REFERENCES "scholarship_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6) Columnas y enum anteriores ------------------------------------------------------------------
ALTER TABLE "application_evaluations" DROP COLUMN "suggested_level";

ALTER TABLE "applications" DROP COLUMN "assigned_level",
DROP COLUMN "requested_level";

ALTER TABLE "offers" DROP COLUMN "scholarship_levels";

-- DropEnum
DROP TYPE "ScholarshipLevel";
