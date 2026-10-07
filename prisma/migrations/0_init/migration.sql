-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'SALES_OFFICER', 'DELIVERY_SUPPORT', 'DRIVER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'CREDIT', 'PENDING', 'OVERDUE', 'PARTIAL');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('NEW_CUSTOMER', 'EXISTING_CUSTOMER');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PROSPECT');

-- CreateEnum
CREATE TYPE "LookupType" AS ENUM ('CUSTOMER_CATEGORY', 'VISIT_OUTCOME');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'SELECT', 'BOOLEAN', 'MULTI_SELECT');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Kigali',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "initials" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'SALES_OFFICER',
    "avatarUrl" TEXT,
    "phone" TEXT,
    "area" TEXT,
    "employeeCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "category" TEXT NOT NULL,
    "customerType" "CustomerType" NOT NULL DEFAULT 'EXISTING_CUSTOMER',
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "area" TEXT NOT NULL,
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "salespersonId" TEXT,
    "mainProductId" TEXT,
    "monthlyPotential" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "outstandingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "creditLimit" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "category" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "unitOfMeasure" TEXT NOT NULL DEFAULT 'KG',
    "weightKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "salespersonId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "dateOfVisit" DATE NOT NULL,
    "visitOutcome" TEXT NOT NULL,
    "productId" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salesValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "nextFollowUpDate" DATE,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_stages" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "probability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_deals" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "salespersonId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "potentialValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastContact" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextAction" TEXT,
    "followUpDate" DATE,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_targets" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "salespersonId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "targetAmount" DOUBLE PRECISION NOT NULL,
    "targetWeightKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_rules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "thresholdPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lookup_values" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "LookupType" NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lookup_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_definitions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "fieldType" "FieldType" NOT NULL DEFAULT 'TEXT',
    "options" JSONB,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_values" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldDefinitionId" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "payload" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");

-- CreateIndex
CREATE INDEX "customers_organizationId_idx" ON "customers"("organizationId");

-- CreateIndex
CREATE INDEX "customers_salespersonId_idx" ON "customers"("salespersonId");

-- CreateIndex
CREATE UNIQUE INDEX "customers_organizationId_code_key" ON "customers"("organizationId", "code");

-- CreateIndex
CREATE INDEX "products_organizationId_idx" ON "products"("organizationId");

-- CreateIndex
CREATE INDEX "visit_logs_organizationId_idx" ON "visit_logs"("organizationId");

-- CreateIndex
CREATE INDEX "visit_logs_salespersonId_idx" ON "visit_logs"("salespersonId");

-- CreateIndex
CREATE INDEX "visit_logs_customerId_idx" ON "visit_logs"("customerId");

-- CreateIndex
CREATE INDEX "visit_logs_dateOfVisit_idx" ON "visit_logs"("dateOfVisit");

-- CreateIndex
CREATE INDEX "pipeline_stages_organizationId_idx" ON "pipeline_stages"("organizationId");

-- CreateIndex
CREATE INDEX "pipeline_deals_organizationId_idx" ON "pipeline_deals"("organizationId");

-- CreateIndex
CREATE INDEX "pipeline_deals_salespersonId_idx" ON "pipeline_deals"("salespersonId");

-- CreateIndex
CREATE INDEX "pipeline_deals_stageId_idx" ON "pipeline_deals"("stageId");

-- CreateIndex
CREATE INDEX "monthly_targets_organizationId_idx" ON "monthly_targets"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_targets_organizationId_salespersonId_month_year_key" ON "monthly_targets"("organizationId", "salespersonId", "month", "year");

-- CreateIndex
CREATE INDEX "commission_rules_organizationId_idx" ON "commission_rules"("organizationId");

-- CreateIndex
CREATE INDEX "lookup_values_organizationId_type_idx" ON "lookup_values"("organizationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "lookup_values_organizationId_type_label_key" ON "lookup_values"("organizationId", "type", "label");

-- CreateIndex
CREATE INDEX "custom_field_definitions_organizationId_idx" ON "custom_field_definitions"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_definitions_organizationId_entityType_fieldKey_key" ON "custom_field_definitions"("organizationId", "entityType", "fieldKey");

-- CreateIndex
CREATE INDEX "custom_field_values_organizationId_idx" ON "custom_field_values"("organizationId");

-- CreateIndex
CREATE INDEX "custom_field_values_entityType_entityId_idx" ON "custom_field_values"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_values_entityType_entityId_fieldDefinitionId_key" ON "custom_field_values"("entityType", "entityId", "fieldDefinitionId");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_createdAt_idx" ON "audit_logs"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_mainProductId_fkey" FOREIGN KEY ("mainProductId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_logs" ADD CONSTRAINT "visit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_logs" ADD CONSTRAINT "visit_logs_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_logs" ADD CONSTRAINT "visit_logs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_logs" ADD CONSTRAINT "visit_logs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_deals" ADD CONSTRAINT "pipeline_deals_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_deals" ADD CONSTRAINT "pipeline_deals_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_deals" ADD CONSTRAINT "pipeline_deals_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_deals" ADD CONSTRAINT "pipeline_deals_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "pipeline_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_targets" ADD CONSTRAINT "monthly_targets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_targets" ADD CONSTRAINT "monthly_targets_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lookup_values" ADD CONSTRAINT "lookup_values_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_fieldDefinitionId_fkey" FOREIGN KEY ("fieldDefinitionId") REFERENCES "custom_field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

