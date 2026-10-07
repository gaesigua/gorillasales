-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_APPROVAL', 'CONFIRMED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'MTN_MOMO', 'AIRTEL_MONEY', 'BANK_TRANSFER', 'CHEQUE');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('SALES_ORDER', 'INVOICE', 'PAYMENT');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "pricesIncludeVat" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tin" TEXT,
ADD COLUMN     "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 18;

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "outstandingBalance",
ADD COLUMN     "district" TEXT,
ADD COLUMN     "paymentTermsDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "priceListId" TEXT,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "sector" TEXT,
ADD COLUMN     "tin" TEXT,
ALTER COLUMN "monthlyPotential" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "creditLimit" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "pipeline_deals" ALTER COLUMN "potentialValue" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "monthly_targets" ALTER COLUMN "targetAmount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "commission_rules" ALTER COLUMN "value" SET DATA TYPE DECIMAL(14,2);

-- CreateTable
CREATE TABLE "price_lists" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_list_items" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "price_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "salespersonId" TEXT NOT NULL,
    "visitLogId" TEXT,
    "orderDate" DATE NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'CONFIRMED',
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "vatAmount" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "holdReason" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "deliveredById" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_lines" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "unitWeightKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "sales_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "issueDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "vatAmount" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "ebmReceiptNumber" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "paidOn" DATE NOT NULL,
    "receivedById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sequences" (
    "organizationId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("organizationId","type")
);

-- CreateIndex
CREATE UNIQUE INDEX "price_lists_organizationId_name_key" ON "price_lists"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "price_list_items_priceListId_productId_key" ON "price_list_items"("priceListId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_visitLogId_key" ON "sales_orders"("visitLogId");

-- CreateIndex
CREATE INDEX "sales_orders_organizationId_orderDate_idx" ON "sales_orders"("organizationId", "orderDate");

-- CreateIndex
CREATE INDEX "sales_orders_organizationId_status_idx" ON "sales_orders"("organizationId", "status");

-- CreateIndex
CREATE INDEX "sales_orders_customerId_idx" ON "sales_orders"("customerId");

-- CreateIndex
CREATE INDEX "sales_orders_salespersonId_idx" ON "sales_orders"("salespersonId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_organizationId_orderNumber_key" ON "sales_orders"("organizationId", "orderNumber");

-- CreateIndex
CREATE INDEX "sales_order_lines_orderId_idx" ON "sales_order_lines"("orderId");

-- CreateIndex
CREATE INDEX "sales_order_lines_productId_idx" ON "sales_order_lines"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_orderId_key" ON "invoices"("orderId");

-- CreateIndex
CREATE INDEX "invoices_organizationId_dueDate_idx" ON "invoices"("organizationId", "dueDate");

-- CreateIndex
CREATE INDEX "invoices_customerId_idx" ON "invoices"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_organizationId_invoiceNumber_key" ON "invoices"("organizationId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");

-- CreateIndex
CREATE INDEX "payments_customerId_idx" ON "payments"("customerId");

-- CreateIndex
CREATE INDEX "payments_organizationId_paidOn_idx" ON "payments"("organizationId", "paidOn");

-- CreateIndex
CREATE UNIQUE INDEX "payments_organizationId_paymentNumber_key" ON "payments"("organizationId", "paymentNumber");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_visitLogId_fkey" FOREIGN KEY ("visitLogId") REFERENCES "visit_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- DATA MIGRATION: historical visit sales -> delivered orders + invoices
-- Each visit with a sale becomes a DELIVERED order with one line and an invoice
-- issued on the visit date. Visits marked PAID also get a full cash payment.
-- ============================================================================
CREATE TEMP TABLE "_visit_sales" AS
SELECT
  v."id" AS visit_id,
  v."organizationId",
  v."customerId",
  v."salespersonId",
  v."productId",
  v."dateOfVisit",
  v."quantity",
  v."unitPrice",
  v."salesValue",
  v."paymentStatus"::text AS payment_status,
  v."createdAt",
  COALESCE(p."weightKg", 0) AS unit_weight,
  o."vatRate" AS vat_rate,
  ROUND((v."salesValue" / (1 + o."vatRate" / 100))::numeric, 2) AS subtotal,
  ROW_NUMBER() OVER (PARTITION BY v."organizationId" ORDER BY v."dateOfVisit", v."createdAt", v."id") AS seq,
  gen_random_uuid()::text AS order_id,
  gen_random_uuid()::text AS invoice_id
FROM "visit_logs" v
JOIN "organizations" o ON o."id" = v."organizationId"
LEFT JOIN "products" p ON p."id" = v."productId"
WHERE v."salesValue" > 0 AND v."productId" IS NOT NULL;

INSERT INTO "sales_orders" ("id", "organizationId", "orderNumber", "customerId", "salespersonId", "visitLogId",
  "orderDate", "status", "paymentTermsDays", "subtotal", "vatAmount", "total", "notes", "createdById",
  "deliveredById", "deliveredAt", "createdAt", "updatedAt")
SELECT order_id, "organizationId", 'SO-' || LPAD(seq::text, 6, '0'), "customerId", "salespersonId", visit_id,
  "dateOfVisit", 'DELIVERED', 0, subtotal, ROUND(("salesValue" - subtotal)::numeric, 2), ROUND("salesValue"::numeric, 2),
  'Migrated from visit log', "salespersonId", "salespersonId", "createdAt", "createdAt", CURRENT_TIMESTAMP
FROM "_visit_sales";

INSERT INTO "sales_order_lines" ("id", "orderId", "productId", "quantity", "unitPrice", "unitWeightKg", "lineTotal")
SELECT gen_random_uuid()::text, order_id, "productId", "quantity", "unitPrice", unit_weight, ROUND("salesValue"::numeric, 2)
FROM "_visit_sales";

INSERT INTO "invoices" ("id", "organizationId", "invoiceNumber", "orderId", "customerId", "issueDate", "dueDate",
  "vatRate", "subtotal", "vatAmount", "total", "createdAt", "updatedAt")
SELECT invoice_id, "organizationId", 'INV-' || LPAD(seq::text, 6, '0'), order_id, "customerId", "dateOfVisit", "dateOfVisit",
  vat_rate, subtotal, ROUND(("salesValue" - subtotal)::numeric, 2), ROUND("salesValue"::numeric, 2), "createdAt", CURRENT_TIMESTAMP
FROM "_visit_sales";

INSERT INTO "payments" ("id", "organizationId", "paymentNumber", "invoiceId", "customerId", "amount", "method",
  "reference", "paidOn", "receivedById", "notes", "createdAt")
SELECT gen_random_uuid()::text, "organizationId",
  'RCT-' || LPAD((ROW_NUMBER() OVER (PARTITION BY "organizationId" ORDER BY seq))::text, 6, '0'),
  invoice_id, "customerId", ROUND("salesValue"::numeric, 2), 'CASH', NULL, "dateOfVisit", "salespersonId",
  'Migrated from visit log (marked Paid)', "createdAt"
FROM "_visit_sales"
WHERE payment_status = 'PAID';

INSERT INTO "document_sequences" ("organizationId", "type", "lastNumber")
SELECT "organizationId", 'SALES_ORDER'::"DocumentType", COUNT(*) FROM "_visit_sales" GROUP BY "organizationId"
UNION ALL
SELECT "organizationId", 'INVOICE'::"DocumentType", COUNT(*) FROM "_visit_sales" GROUP BY "organizationId"
UNION ALL
SELECT "organizationId", 'PAYMENT'::"DocumentType", COUNT(*) FROM "_visit_sales" WHERE payment_status = 'PAID' GROUP BY "organizationId";

DROP TABLE "_visit_sales";

-- ============================================================================
-- Remove the per-visit sales columns now that sales live on orders
-- ============================================================================
-- DropForeignKey
ALTER TABLE "visit_logs" DROP CONSTRAINT "visit_logs_productId_fkey";

-- AlterTable
ALTER TABLE "visit_logs" DROP COLUMN "paymentStatus",
DROP COLUMN "productId",
DROP COLUMN "quantity",
DROP COLUMN "salesValue",
DROP COLUMN "unitPrice";

-- DropEnum
DROP TYPE "PaymentStatus";

