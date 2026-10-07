-- Add depositAmount column to invoices table
ALTER TABLE "invoices" ADD COLUMN "depositAmount" REAL NOT NULL DEFAULT 0;
