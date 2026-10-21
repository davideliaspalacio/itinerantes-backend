-- CreateTable
CREATE TABLE "site_metrics" (
    "key" VARCHAR(60) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "value" INTEGER NOT NULL,
    "prefix" VARCHAR(10) NOT NULL DEFAULT '',
    "suffix" VARCHAR(10) NOT NULL DEFAULT '',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "site_metrics_pkey" PRIMARY KEY ("key")
);
