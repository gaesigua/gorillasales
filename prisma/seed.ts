import { PrismaClient, UserRole, PaymentStatus, CustomerType, FieldType } from '@prisma/client';

import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const seedPassword = process.env.SEED_USER_PASSWORD;
  if (!seedPassword || seedPassword.length < 10) {
    throw new Error('Set SEED_USER_PASSWORD (min 10 chars) — it becomes the initial password of every seeded user.');
  }
  const passwordHash = await bcrypt.hash(seedPassword, 12);

  console.log('🌱 Starting GorillaSales Enterprise Database Seeding...');

  // 1. Clean existing records (Optional for idempotency)
  await prisma.auditLog.deleteMany();
  await prisma.customFieldValue.deleteMany();
  await prisma.customFieldDefinition.deleteMany();
  await prisma.visitLog.deleteMany();
  await prisma.pipelineDeal.deleteMany();
  await prisma.pipelineStage.deleteMany();
  await prisma.monthlyTarget.deleteMany();
  await prisma.commissionRule.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // 2. Create Default Tenant Organization
  const org = await prisma.organization.create({
    data: {
      name: 'Gorilla Coffee Distribution Ltd',
      slug: 'gorilla-coffee',
      currency: 'RWF',
      timezone: 'Africa/Kigali',
    },
  });

  console.log(`✅ Organization created: ${org.name} (${org.id})`);

  // 3. Create Users & Sales Team
  const manager = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'eric.m@gorillacoffee.rw',
      name: 'Mugabe Eric',
      initials: 'ME',
      passwordHash,
      role: UserRole.MANAGER,
    },
  });

  const repRemmy = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'remmy.k@gorillacoffee.rw',
      name: 'Karenzi Remmy',
      initials: 'KR',
      passwordHash,
      role: UserRole.SALES_OFFICER,
    },
  });

  const repAlex = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'alex.m@gorillacoffee.rw',
      name: 'Alex Mushumba',
      initials: 'AM',
      passwordHash,
      role: UserRole.SALES_OFFICER,
    },
  });

  const repPatience = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'patience.i@gorillacoffee.rw',
      name: 'Isimbi Patience',
      initials: 'IP',
      passwordHash,
      role: UserRole.SALES_OFFICER,
    },
  });

  const repFrank = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'frank.m@gorillacoffee.rw',
      name: 'Mastiko Frank',
      initials: 'MF',
      passwordHash,
      role: UserRole.SALES_OFFICER,
    },
  });

  const repDan = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'dan.m@gorillacoffee.rw',
      name: 'Muyenzi Dan',
      initials: 'MD',
      passwordHash,
      role: UserRole.SALES_OFFICER,
    },
  });

  console.log(`✅ Users created: Manager + 5 Sales Officers`);

  // 4. Products Catalog
  const prod250g = await prisma.product.create({
    data: {
      organizationId: org.id,
      name: '250G Roasted Coffee',
      sku: 'COF-250G',
      category: 'Roasted Coffee',
      unitPrice: 2600,
      unitOfMeasure: 'Pack',
    },
  });

  const prod500g = await prisma.product.create({
    data: {
      organizationId: org.id,
      name: '500G Medium Ground (MG)',
      sku: 'COF-500G-MG',
      category: 'Roasted Coffee',
      unitPrice: 4800,
      unitOfMeasure: 'Pack',
    },
  });

  const prod1kg = await prisma.product.create({
    data: {
      organizationId: org.id,
      name: '1KG Roasted Coffee Beans',
      sku: 'COF-1KG-BEAN',
      category: 'Roasted Coffee',
      unitPrice: 9000,
      unitOfMeasure: 'KG',
    },
  });

  console.log(`✅ Products catalog created`);

  // 5. Customers CRM
  const custNakumatt = await prisma.customer.create({
    data: {
      organizationId: org.id,
      name: 'Nakumatt Kigali City Mall',
      code: 'CUST-001',
      category: 'Supermarkets',
      customerType: CustomerType.EXISTING_CUSTOMER,
      area: 'Kigali Centre',
      contactPerson: 'Jean Paul Habimana',
      email: 'jp.habimana@nakumatt.rw',
      phone: '+250 788 123 456',
      salespersonId: repRemmy.id,
      outstandingBalance: 450000,
      creditLimit: 2000000,
    },
  });

  const custMilleCollines = await prisma.customer.create({
    data: {
      organizationId: org.id,
      name: 'Hotel des Mille Collines',
      code: 'CUST-002',
      category: 'Hotels',
      customerType: CustomerType.EXISTING_CUSTOMER,
      area: 'Kigali Centre',
      contactPerson: 'Marie Claire Uwamahoro',
      email: 'procurement@millecollines.rw',
      phone: '+250 788 654 321',
      salespersonId: repFrank.id,
      outstandingBalance: 312000,
      creditLimit: 1500000,
    },
  });

  const custBourbon = await prisma.customer.create({
    data: {
      organizationId: org.id,
      name: 'Bourbon Coffee Kimihurura',
      code: 'CUST-003',
      category: 'Coffee Shops',
      customerType: CustomerType.EXISTING_CUSTOMER,
      area: 'Kimihurura',
      contactPerson: 'Claudine Uwase',
      email: 'claudine@bourboncoffee.rw',
      phone: '+250 788 999 888',
      salespersonId: repAlex.id,
      outstandingBalance: 0,
      creditLimit: 3000000,
    },
  });

  console.log(`✅ Customers created`);

  // 6. Pipeline Stages & Deals
  const stageLead = await prisma.pipelineStage.create({
    data: { organizationId: org.id, name: 'Lead', probability: 10, sortOrder: 1, color: '#94A3B8' },
  });
  const stageContacted = await prisma.pipelineStage.create({
    data: { organizationId: org.id, name: 'Contacted', probability: 25, sortOrder: 2, color: '#3B82F6' },
  });
  const stageProposal = await prisma.pipelineStage.create({
    data: { organizationId: org.id, name: 'Proposal Sent', probability: 40, sortOrder: 3, color: '#8B5CF6' },
  });
  const stageClosing = await prisma.pipelineStage.create({
    data: { organizationId: org.id, name: 'Closing', probability: 80, sortOrder: 4, color: '#F59E0B' },
  });
  const stageWon = await prisma.pipelineStage.create({
    data: { organizationId: org.id, name: 'Won', probability: 100, sortOrder: 5, color: '#10B981' },
  });

  await prisma.pipelineDeal.create({
    data: {
      organizationId: org.id,
      title: 'Radisson Blu Annual Coffee Supply Contract',
      customerId: custMilleCollines.id,
      salespersonId: repRemmy.id,
      stageId: stageProposal.id,
      potentialValue: 2400000,
      probability: 40,
      weightedValue: 960000,
      nextAction: 'Send updated pricing proposal',
      followUpDate: new Date('2026-09-30'),
      remarks: 'High strategic hotel client',
    },
  });

  await prisma.pipelineDeal.create({
    data: {
      organizationId: org.id,
      title: 'Bourbon Coffee Pods Supply Deal',
      customerId: custBourbon.id,
      salespersonId: repAlex.id,
      stageId: stageClosing.id,
      potentialValue: 4200000,
      probability: 80,
      weightedValue: 3360000,
      nextAction: 'Final contract signature',
      followUpDate: new Date('2026-10-05'),
      remarks: 'Exclusive coffee pods distribution',
    },
  });

  console.log(`✅ Pipeline stages & deals created`);

  // 7. Visit Logs
  await prisma.visitLog.create({
    data: {
      organizationId: org.id,
      salespersonId: repRemmy.id,
      customerId: custNakumatt.id,
      dateOfVisit: new Date('2026-09-04'),
      visitOutcome: 'Order Placed',
      productId: prod500g.id,
      quantity: 48,
      unitPrice: 4800,
      salesValue: 230400,
      paymentStatus: PaymentStatus.PAID,
      remarks: 'Increased order volume by 20%',
    },
  });

  await prisma.visitLog.create({
    data: {
      organizationId: org.id,
      salespersonId: repFrank.id,
      customerId: custMilleCollines.id,
      dateOfVisit: new Date('2026-09-04'),
      visitOutcome: 'Order Placed',
      productId: prod250g.id,
      quantity: 120,
      unitPrice: 2600,
      salesValue: 312000,
      paymentStatus: PaymentStatus.CREDIT,
      remarks: 'Monthly standing order confirmed',
    },
  });

  console.log(`✅ Visit logs created`);

  // 8. Monthly Targets
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const reps = [repRemmy, repAlex, repPatience, repFrank, repDan];
  const targets = [4000000, 3800000, 3200000, 3500000, 3600000];
  const weightTargets = [500, 480, 400, 440, 450];

  for (let i = 0; i < reps.length; i++) {
    await prisma.monthlyTarget.create({
      data: {
        organizationId: org.id,
        salespersonId: reps[i].id,
        month: currentMonth,
        year: currentYear,
        targetAmount: targets[i],
        targetWeightKg: weightTargets[i],
      },
    });
  }

  console.log(`✅ Monthly targets seeded`);

  // 9. Commission Rules
  await prisma.commissionRule.createMany({
    data: [
      {
        organizationId: org.id,
        name: 'Base Commission',
        ruleType: 'percentage',
        value: 2.0,
        thresholdPct: 0,
        description: 'Earned on all sales regardless of target',
        sortOrder: 1,
      },
      {
        organizationId: org.id,
        name: 'Target Achievement Bonus',
        ruleType: 'percentage',
        value: 3.0,
        thresholdPct: 100,
        description: 'Extra % bonus when monthly target is 100% achieved',
        sortOrder: 2,
      },
      {
        organizationId: org.id,
        name: 'Top Performer Flat Bonus',
        ruleType: 'flat',
        value: 50000,
        thresholdPct: 150,
        description: 'Flat RWF 50,000 bonus for 150%+ achievement',
        sortOrder: 3,
      },
    ],
  });

  console.log(`✅ Commission rules created`);

  // 10. Twenty CRM-style Custom Fields Demonstration
  const customRoasterField = await prisma.customFieldDefinition.create({
    data: {
      organizationId: org.id,
      entityType: 'CUSTOMER',
      name: 'Coffee Machine Type',
      fieldKey: 'coffee_machine_type',
      fieldType: FieldType.SELECT,
      options: ['Commercial Espresso', 'Filter Brewer', 'Pod Machine', 'Manual Pour-over'],
      isRequired: false,
      sortOrder: 1,
    },
  });

  await prisma.customFieldValue.create({
    data: {
      organizationId: org.id,
      entityType: 'CUSTOMER',
      entityId: custBourbon.id,
      fieldDefinitionId: customRoasterField.id,
      value: 'Commercial Espresso',
    },
  });

  console.log(`✅ Dynamic custom fields configured and attached`);
  console.log('🎉 GorillaSales Database Seeding Completed Successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error Seeding Database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
