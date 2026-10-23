-- Cupo máximo por tipo de beca (aditiva, sin pérdida de datos): null = sin límite.
-- scholarship_types.max_recipients = cupo GLOBAL del tipo (todas las ofertas);
-- offer_scholarship_types.max_recipients = tope adicional solo en esa oferta.

-- AlterTable
ALTER TABLE "scholarship_types" ADD COLUMN "max_recipients" INTEGER,
ADD CONSTRAINT "scholarship_types_max_recipients_check"
    CHECK ("max_recipients" IS NULL OR "max_recipients" >= 1);

-- AlterTable
ALTER TABLE "offer_scholarship_types" ADD COLUMN "max_recipients" INTEGER,
ADD CONSTRAINT "offer_scholarship_types_max_recipients_check"
    CHECK ("max_recipients" IS NULL OR "max_recipients" >= 1);

-- CreateIndex (conteo del cupo usado por tipo y estado)
CREATE INDEX "applications_assigned_scholarship_type_id_status_idx" ON "applications"("assigned_scholarship_type_id", "status");
