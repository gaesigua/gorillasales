// Demo data for local development: one organization (Gorilla Coffee), its team, catalogue,
// customers, pipeline, targets and ~6 months of generated visit history dated relative to
// today, so dashboards and reports have realistic numbers.
//
//   SEED_USER_PASSWORD=...  initial password for every seeded user (required, min 10 chars)
//   SEED_ALLOW_RESET=yes    required when the database already has data: the seed WIPES it
//
// Never run this against a production database.
import {
  PrismaClient,
  UserRole,
  CustomerType,
  CustomerStatus,
  FieldType,
  LookupType,
  OrderStatus,
  PaymentMethod,
  DocumentType,
  type Prisma,
  type StockMovementType,
} from '@prisma/client';
import { computeOrderTotals } from '../src/lib/domain/money';
import { allocateFifo, round3 } from '../src/lib/domain/inventory';
import { isRouteDay, WEEKDAY_LABELS } from '../src/lib/domain/routes';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Deterministic pseudo-random numbers so every seed run produces the same data
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260907);
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T>(items: T[]): T => items[Math.floor(rand() * items.length)];

function kigaliToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(new Date());
}
const dateCol = (s: string) => new Date(`${s}T00:00:00.000Z`);
const dateColumnString = (d: Date) => d.toISOString().slice(0, 10);
function addDays(s: string, days: number): string {
  const d = dateCol(s);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const TEAM = [
  {
    name: 'Mugabe Eric',
    email: 'eric.m@gorillacoffee.rw',
    role: UserRole.MANAGER,
    code: 'GS-MGR-001',
    area: 'Kigali',
  },
  {
    name: 'Umwari Lilian',
    email: 'lilian.u@gorillacoffee.rw',
    role: UserRole.ADMIN,
    code: 'GS-ADM-001',
    area: 'Head Office',
  },
  {
    name: 'Karenzi Remmy',
    email: 'remmy.k@gorillacoffee.rw',
    role: UserRole.SALES_OFFICER,
    code: 'GS-OFF-001',
    area: 'Kigali Centre',
  },
  {
    name: 'Alex Mushumba',
    email: 'alex.m@gorillacoffee.rw',
    role: UserRole.SALES_OFFICER,
    code: 'GS-OFF-002',
    area: 'Kimihurura / Kacyiru',
  },
  {
    name: 'Isimbi Patience',
    email: 'patience.i@gorillacoffee.rw',
    role: UserRole.SALES_OFFICER,
    code: 'GS-OFF-003',
    area: 'Remera / Nyarutarama',
  },
  {
    name: 'Mastiko Frank',
    email: 'frank.m@gorillacoffee.rw',
    role: UserRole.SALES_OFFICER,
    code: 'GS-OFF-004',
    area: 'Gisozi / Nyamirambo',
  },
  {
    name: 'Muyenzi Dan',
    email: 'dan.m@gorillacoffee.rw',
    role: UserRole.SALES_OFFICER,
    code: 'GS-OFF-005',
    area: 'Nyabugogo / Kiyovu',
  },
  {
    name: 'Herve Ndayisaba',
    email: 'herve.n@gorillacoffee.rw',
    role: UserRole.DELIVERY_SUPPORT,
    code: 'GS-DEL-001',
    area: 'Warehouse',
  },
  {
    name: 'Gakuba Samson',
    email: 'samson.g@gorillacoffee.rw',
    role: UserRole.DRIVER,
    code: 'GS-DRV-001',
    area: 'Kigali',
  },
];

const MONTHLY_TARGETS: Record<string, number> = {
  'Karenzi Remmy': 4000000,
  'Mastiko Frank': 3500000,
  'Isimbi Patience': 3200000,
  'Alex Mushumba': 3800000,
  'Muyenzi Dan': 3600000,
};

const CATEGORIES = [
  'Hotels',
  'Coffee Shops',
  'Wholesalers',
  'Supermarkets',
  'Shops',
  'Stores',
  'Galleries',
  'Offices',
];
const OUTCOMES = {
  order: 'Order Placed',
  visit: 'No Order / Visit Only',
  followUp: 'Follow-up Required',
};

const PRODUCTS: {
  name: string;
  sku: string;
  category: string;
  unitPrice: number;
  unitOfMeasure: string;
  weightKg: number;
  kind: 'FINISHED' | 'GREEN';
  shelfLifeDays: number | null;
}[] = [
  {
    name: '250G Roasted Coffee',
    sku: 'RC-250',
    category: 'Roasted Coffee',
    unitPrice: 2600,
    unitOfMeasure: 'Pack',
    weightKg: 0.25,
    kind: 'FINISHED',
    shelfLifeDays: 180,
  },
  {
    name: '500G MG',
    sku: 'MG-500',
    category: 'Roasted Coffee',
    unitPrice: 4800,
    unitOfMeasure: 'Pack',
    weightKg: 0.5,
    kind: 'FINISHED',
    shelfLifeDays: 180,
  },
  {
    name: '1KG Roasted Coffee',
    sku: 'RC-1000',
    category: 'Roasted Coffee',
    unitPrice: 9000,
    unitOfMeasure: 'KG',
    weightKg: 1,
    kind: 'FINISHED',
    shelfLifeDays: 180,
  },
  {
    name: 'Instant Coffee Sachets',
    sku: 'IN-BOX',
    category: 'Instant',
    unitPrice: 1500,
    unitOfMeasure: 'Box',
    weightKg: 0.1,
    kind: 'FINISHED',
    shelfLifeDays: 365,
  },
  {
    name: 'Green Coffee Beans',
    sku: 'GR-1000',
    category: 'Green Coffee',
    unitPrice: 7500,
    unitOfMeasure: 'KG',
    weightKg: 1,
    kind: 'GREEN',
    shelfLifeDays: 365,
  },
  {
    name: 'Coffee Pods 10-pack',
    sku: 'POD-10',
    category: 'Pods',
    unitPrice: 3500,
    unitOfMeasure: 'Pack',
    weightKg: 0.07,
    kind: 'FINISHED',
    shelfLifeDays: 270,
  },
];

/** Typical roast yield: roasted weight / green weight. */
const ROAST_YIELD = 0.82;

// name | category | area | contact | phone | rep | main product | monthly potential | status | remarks | new this month
const CUSTOMERS: [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  number,
  CustomerStatus,
  string,
  boolean,
][] = [
  [
    'Nakumatt Kigali City Mall',
    'Supermarkets',
    'Kigali Centre',
    'Jean-Pierre Habiyaremye',
    '+250 788 123 456',
    'Karenzi Remmy',
    '500G MG',
    800000,
    'ACTIVE',
    'Key account — priority service',
    false,
  ],
  [
    'Hotel des Mille Collines',
    'Hotels',
    'Kigali Centre',
    'Solange Niyonkuru',
    '+250 788 234 567',
    'Mastiko Frank',
    '250G Roasted Coffee',
    600000,
    'ACTIVE',
    'Monthly standing order — very reliable',
    false,
  ],
  [
    'Simba Supermarket Remera',
    'Supermarkets',
    'Remera',
    'Emmanuel Rukundo',
    '+250 788 345 678',
    'Isimbi Patience',
    '1KG Roasted Coffee',
    700000,
    'ACTIVE',
    'Manager transitions — follow up urgently',
    false,
  ],
  [
    'Bourbon Coffee Kimihurura',
    'Coffee Shops',
    'Kimihurura',
    'Claudine Uwase',
    '+250 788 456 789',
    'Alex Mushumba',
    'Coffee Pods 10-pack',
    900000,
    'ACTIVE',
    'Exclusive pod supply under discussion',
    false,
  ],
  [
    'Kigali Wholesale Hub',
    'Wholesalers',
    'Nyabugogo',
    'Théophile Nkurunziza',
    '+250 788 567 890',
    'Muyenzi Dan',
    'Green Coffee Beans',
    1200000,
    'ACTIVE',
    'New account — 30-day credit terms',
    true,
  ],
  [
    'Marriott Kigali',
    'Hotels',
    'Kigali Centre',
    'Bertrand Gasana',
    '+250 788 678 901',
    'Karenzi Remmy',
    '250G Roasted Coffee',
    1000000,
    'ACTIVE',
    'Premium account — quarterly contract renewal due',
    false,
  ],
  [
    'Quickmart Gisozi',
    'Supermarkets',
    'Gisozi',
    'Anitha Uwimana',
    '+250 788 789 012',
    'Mastiko Frank',
    'Instant Coffee Sachets',
    500000,
    'PROSPECT',
    'Needs pricing sheet — very promising location',
    true,
  ],
  [
    'Café Botanika',
    'Coffee Shops',
    'Nyarutarama',
    'Miriam Ingabire',
    '+250 788 890 123',
    'Isimbi Patience',
    '500G MG',
    400000,
    'ACTIVE',
    'New account — high growth potential',
    true,
  ],
  [
    'Chez Lando Restaurant',
    'Coffee Shops',
    'Kacyiru',
    'Lando Nshimiyimana',
    '+250 788 901 234',
    'Alex Mushumba',
    '250G Roasted Coffee',
    350000,
    'ACTIVE',
    'Stock check needed',
    false,
  ],
  [
    'Ikirezi Natural Products',
    'Shops',
    'Kiyovu',
    'Vestine Mukamazimpaka',
    '+250 788 012 345',
    'Muyenzi Dan',
    'Instant Coffee Sachets',
    480000,
    'ACTIVE',
    '',
    false,
  ],
  [
    'Radisson Blu Kigali',
    'Hotels',
    'Kigali Centre',
    'Christophe Murenzi',
    '+250 788 111 222',
    'Karenzi Remmy',
    '250G Roasted Coffee',
    1100000,
    'ACTIVE',
    'Annual contract under negotiation',
    false,
  ],
  [
    'Nyamirambo Corner Store',
    'Stores',
    'Nyamirambo',
    'Odette Kabasinga',
    '+250 788 333 444',
    'Mastiko Frank',
    '250G Roasted Coffee',
    200000,
    'INACTIVE',
    'Inactive — re-engagement needed',
    false,
  ],
  [
    'Kigali Convention Centre',
    'Hotels',
    'Kimihurura',
    'Events Procurement',
    '+250 788 444 555',
    'Mastiko Frank',
    '1KG Roasted Coffee',
    1500000,
    'PROSPECT',
    'Event catering supply',
    false,
  ],
  [
    'MTN Rwanda HQ Canteen',
    'Offices',
    'Nyarutarama',
    'Canteen Manager',
    '+250 788 555 666',
    'Isimbi Patience',
    '500G MG',
    600000,
    'PROSPECT',
    'Corporate canteen — high volume daily',
    true,
  ],
];

// customer | potential value | stage | next action | follow-up in N days | remarks
const DEALS: [string, number, string, string, number, string][] = [
  [
    'Radisson Blu Kigali',
    2400000,
    'Proposal',
    'Send updated pricing proposal',
    4,
    'Annual contract — high value',
  ],
  [
    'Kigali Convention Centre',
    3600000,
    'Closing',
    'Final contract sign-off',
    2,
    'Event catering supply — near close',
  ],
  [
    'Kigali Wholesale Hub',
    5000000,
    'Contacted',
    'Arrange product tasting session',
    10,
    'Large volume — needs credit facility approval',
  ],
  [
    'MTN Rwanda HQ Canteen',
    1800000,
    'Prospecting',
    'Initial intro meeting',
    21,
    'Corporate canteen — high volume daily',
  ],
  [
    'Bourbon Coffee Kimihurura',
    4200000,
    'Proposal',
    'Present exclusive supply agreement',
    35,
    'Exclusive pod deal — high strategic value',
  ],
  ['Quickmart Gisozi', 900000, 'Contacted', 'Share pricing sheet', -3, 'Promising location'],
  ['Marriott Kigali', 3000000, 'Won', 'Schedule first delivery', 0, 'Quarterly contract renewed'],
];

const STAGES = [
  { name: 'Prospecting', probability: 20, color: '#94A3B8' },
  { name: 'Contacted', probability: 40, color: '#60A5FA' },
  { name: 'Proposal', probability: 65, color: '#FBBF24' },
  { name: 'Closing', probability: 85, color: '#F97316' },
  { name: 'Won', probability: 100, color: '#22C55E' },
  { name: 'Lost', probability: 0, color: '#EF4444' },
];

// Commercial terms by channel: payment days (0 = cash on delivery) and price list
const TERMS: Record<string, { days: number; priceList?: string }> = {
  Wholesalers: { days: 30, priceList: 'Wholesale' },
  Supermarkets: { days: 30 },
  Hotels: { days: 30, priceList: 'Hotels & HoReCa' },
  Offices: { days: 14, priceList: 'Hotels & HoReCa' },
  'Coffee Shops': { days: 14 },
  Shops: { days: 0 },
  Stores: { days: 0 },
};

// District per sales area, for the Province/District address fields
const AREA_DISTRICT: Record<string, string> = {
  'Kigali Centre': 'Nyarugenge',
  Nyabugogo: 'Nyarugenge',
  Nyamirambo: 'Nyarugenge',
  Kiyovu: 'Nyarugenge',
  Remera: 'Gasabo',
  Kimihurura: 'Gasabo',
  Gisozi: 'Gasabo',
  Nyarutarama: 'Gasabo',
  Kacyiru: 'Gasabo',
};

// Order sizes by channel (units per order)
const ORDER_QTY: Record<string, [number, number]> = {
  Wholesalers: [80, 200],
  Supermarkets: [40, 120],
  Hotels: [30, 90],
  Offices: [20, 60],
  'Coffee Shops': [15, 50],
  Shops: [10, 30],
  Stores: [10, 30],
};

async function main() {
  const seedPassword = process.env.SEED_USER_PASSWORD;
  if (!seedPassword || seedPassword.length < 10) {
    throw new Error(
      'Set SEED_USER_PASSWORD (min 10 chars) — it becomes the initial password of every seeded user.'
    );
  }
  if ((await prisma.organization.count()) > 0 && process.env.SEED_ALLOW_RESET !== 'yes') {
    throw new Error(
      'Database already has data. Re-run with SEED_ALLOW_RESET=yes to WIPE it and reseed.'
    );
  }
  const passwordHash = await bcrypt.hash(seedPassword, 12);
  const today = kigaliToday();

  console.log('🌱 Seeding GorillaSales demo data...');

  // 1. Wipe (children first)
  await prisma.auditLog.deleteMany();
  await prisma.customFieldValue.deleteMany();
  await prisma.customFieldDefinition.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.creditNote.deleteMany();
  await prisma.route.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.salesOrderLine.deleteMany();
  await prisma.salesOrder.deleteMany();
  await prisma.deliveryRun.deleteMany();
  await prisma.stockBatch.deleteMany();
  await prisma.roastRun.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.documentSequence.deleteMany();
  await prisma.visitLog.deleteMany();
  await prisma.pipelineDeal.deleteMany();
  await prisma.pipelineStage.deleteMany();
  await prisma.monthlyTarget.deleteMany();
  await prisma.commissionRule.deleteMany();
  await prisma.lookupValue.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.priceListItem.deleteMany();
  await prisma.priceList.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // 2. Organization
  const org = await prisma.organization.create({
    data: {
      name: 'Gorilla Coffee Distribution Ltd',
      slug: 'gorilla-coffee',
      currency: 'RWF',
      timezone: 'Africa/Kigali',
      tin: '101234567',
      vatRate: 18,
      pricesIncludeVat: true,
    },
  });
  const organizationId = org.id;

  // 3. Team
  const users = new Map<string, string>();
  for (const member of TEAM) {
    const user = await prisma.user.create({
      data: {
        organizationId,
        email: member.email,
        name: member.name,
        initials: member.name
          .split(' ')
          .map((p) => p[0])
          .join('')
          .slice(0, 2)
          .toUpperCase(),
        role: member.role,
        employeeCode: member.code,
        area: member.area,
        phone: `+250 788 ${randInt(100, 999)} ${randInt(100, 999)}`,
        passwordHash,
        createdAt: dateCol(addDays(today, -400)),
      },
    });
    users.set(member.name, user.id);
  }
  const userId = (name: string) => users.get(name)!;

  // 4. Lookup lists
  await prisma.lookupValue.createMany({
    data: [
      ...CATEGORIES.map((label, i) => ({
        organizationId,
        type: LookupType.CUSTOMER_CATEGORY,
        label,
        sortOrder: i + 1,
      })),
      ...Object.values(OUTCOMES).map((label, i) => ({
        organizationId,
        type: LookupType.VISIT_OUTCOME,
        label,
        sortOrder: i + 1,
      })),
    ],
  });

  // 5. Products
  const products = new Map<string, { id: string; unitPrice: number }>();
  for (const p of PRODUCTS) {
    const product = await prisma.product.create({ data: { organizationId, ...p } });
    products.set(p.name, { id: product.id, unitPrice: p.unitPrice });
  }

  // 5b. Price lists: HoReCa ~5% and wholesale ~10% below standard on roasted coffee
  const priceLists = new Map<string, { id: string; prices: Map<string, number> }>();
  for (const [name, discount] of [
    ['Hotels & HoReCa', 0.05],
    ['Wholesale', 0.1],
  ] as const) {
    const items = PRODUCTS.filter(
      (p) => p.category === 'Roasted Coffee' || p.category === 'Green Coffee'
    ).map((p) => ({
      productId: products.get(p.name)!.id,
      unitPrice: Math.round((p.unitPrice * (1 - discount)) / 10) * 10,
    }));
    const list = await prisma.priceList.create({
      data: {
        organizationId,
        name,
        description: `${discount * 100}% off roasted & green coffee`,
        items: { create: items },
      },
    });
    priceLists.set(name, {
      id: list.id,
      prices: new Map(items.map((i) => [i.productId, i.unitPrice])),
    });
  }
  const priceOf = (productName: string, priceListName?: string) => {
    const product = products.get(productName)!;
    return (
      (priceListName && priceLists.get(priceListName)?.prices.get(product.id)) || product.unitPrice
    );
  };

  // 6. Customers
  const customers: {
    id: string;
    name: string;
    category: string;
    repId: string;
    productName: string;
    status: CustomerStatus;
    terms: number;
    priceList?: string;
  }[] = [];
  for (const [i, c] of CUSTOMERS.entries()) {
    const [
      name,
      category,
      area,
      contactPerson,
      phone,
      rep,
      mainProduct,
      monthlyPotential,
      status,
      remarks,
      isNew,
    ] = c;
    const customer = await prisma.customer.create({
      data: {
        organizationId,
        code: `CUST-${String(i + 1).padStart(4, '0')}`,
        name,
        category,
        area,
        contactPerson,
        phone,
        salespersonId: userId(rep),
        mainProductId: products.get(mainProduct)!.id,
        monthlyPotential,
        paymentTermsDays: TERMS[category]?.days ?? 0,
        creditLimit: (TERMS[category]?.days ?? 0) > 0 ? monthlyPotential * 3 : 0,
        priceListId: TERMS[category]?.priceList
          ? priceLists.get(TERMS[category].priceList!)!.id
          : null,
        tin: i % 3 === 0 ? null : String(100000000 + i * 7919),
        province: 'Kigali City',
        district: AREA_DISTRICT[area] ?? null,
        sector: area,
        status,
        customerType: isNew ? CustomerType.NEW_CUSTOMER : CustomerType.EXISTING_CUSTOMER,
        remarks: remarks || null,
        createdAt: isNew
          ? dateCol(addDays(today, -randInt(1, 5)))
          : dateCol(addDays(today, -randInt(200, 500))),
      },
    });
    customers.push({
      id: customer.id,
      name,
      category,
      repId: userId(rep),
      productName: mainProduct,
      status,
      terms: TERMS[category]?.days ?? 0,
      priceList: TERMS[category]?.priceList,
    });
  }

  // 7. Pipeline
  const stages = new Map<string, string>();
  for (const [i, s] of STAGES.entries()) {
    const stage = await prisma.pipelineStage.create({
      data: { organizationId, ...s, sortOrder: i + 1 },
    });
    stages.set(s.name, stage.id);
  }
  for (const [customerName, potentialValue, stage, nextAction, followUpIn, remarks] of DEALS) {
    const customer = customers.find((c) => c.name === customerName)!;
    await prisma.pipelineDeal.create({
      data: {
        organizationId,
        title: `${customerName} — supply agreement`,
        customerId: customer.id,
        salespersonId: customer.repId,
        stageId: stages.get(stage)!,
        potentialValue,
        nextAction,
        followUpDate: dateCol(addDays(today, followUpIn)),
        lastContact: dateCol(addDays(today, -randInt(1, 10))),
        remarks,
      },
    });
  }

  // 8. Targets: last 5 months, this month and next month
  const [ty, tm] = today.split('-').map(Number);
  for (let offset = -5; offset <= 1; offset++) {
    const d = new Date(Date.UTC(ty, tm - 1 + offset, 1));
    for (const [rep, amount] of Object.entries(MONTHLY_TARGETS)) {
      await prisma.monthlyTarget.create({
        data: {
          organizationId,
          salespersonId: userId(rep),
          month: d.getUTCMonth(),
          year: d.getUTCFullYear(),
          targetAmount: amount,
          targetWeightKg: Math.round(amount / 9000),
        },
      });
    }
  }

  // 9. Visit history with orders, invoices and payments: ~6 months up to today
  const productNames = [...products.keys()];
  const activeCustomers = customers.filter((c) => c.status !== 'INACTIVE');
  const startDate = `${new Date(Date.UTC(ty, tm - 6, 1)).toISOString().slice(0, 7)}-01`;

  // 9a. Routes: each rep's active customers split into a weekly route and a fortnightly one
  const routePlans: {
    rep: string;
    name: string;
    weekday: number;
    frequency: 'WEEKLY' | 'BIWEEKLY';
    startDate: string;
    customerIds: string[];
  }[] = [];
  for (const [i, repName] of Object.keys(MONTHLY_TARGETS).entries()) {
    const own = activeCustomers.filter((c) => c.repId === userId(repName));
    if (own.length === 0) continue;
    const weekly = own.filter((_, k) => k % 2 === 0);
    const fortnightly = own.filter((_, k) => k % 2 === 1);
    const plans = [
      {
        name: `${repName.split(' ')[0]} ${WEEKDAY_LABELS[(i % 5) + 1]}`,
        weekday: (i % 5) + 1,
        frequency: 'WEEKLY' as const,
        customerIds: weekly.map((c) => c.id),
      },
      {
        name: `${repName.split(' ')[0]} ${WEEKDAY_LABELS[((i + 2) % 5) + 1]} (fortnightly)`,
        weekday: ((i + 2) % 5) + 1,
        frequency: 'BIWEEKLY' as const,
        customerIds: fortnightly.map((c) => c.id),
      },
    ].filter((r) => r.customerIds.length > 0);
    for (const plan of plans) {
      await prisma.route.create({
        data: {
          organizationId,
          name: plan.name,
          salespersonId: userId(repName),
          weekday: plan.weekday,
          frequency: plan.frequency,
          startDate: dateCol(startDate),
          stops: {
            create: plan.customerIds.map((customerId, k) => ({ customerId, sortOrder: k + 1 })),
          },
        },
      });
      routePlans.push({ rep: repName, startDate, ...plan });
    }
  }
  const seq: Record<DocumentType, number> = {
    SALES_ORDER: 0,
    INVOICE: 0,
    PAYMENT: 0,
    ROAST_RUN: 0,
    DELIVERY_RUN: 0,
    CREDIT_NOTE: 0,
    REFUND: 0,
  };
  // Delivered orders, replayed against stock in step 10
  const deliveredLog: {
    orderId: string;
    deliveredOn: string;
    lines: { productId: string; quantity: number }[];
  }[] = [];
  const openOrders: {
    orderId: string;
    status: OrderStatus;
    lines: { productId: string; quantity: number }[];
  }[] = [];
  const docNo = (type: DocumentType, prefix: string) =>
    `${prefix}-${String(++seq[type]).padStart(6, '0')}`;
  const methods: PaymentMethod[] = [
    'CASH',
    'MTN_MOMO',
    'MTN_MOMO',
    'AIRTEL_MONEY',
    'BANK_TRANSFER',
  ];
  let visitCount = 0;
  let orderCount = 0;
  let heldOnce = false;

  for (let day = startDate; day <= today; day = addDays(day, 1)) {
    if (dateCol(day).getUTCDay() === 0) continue; // no Sunday visits
    for (const repName of Object.keys(MONTHLY_TARGETS)) {
      const repCustomers = activeCustomers.filter((c) => c.repId === userId(repName));
      if (repCustomers.length === 0) continue;
      // Planned route stops (about 85% visited) plus the occasional unplanned visit
      const todays = routePlans
        .filter((r) => r.rep === repName && isRouteDay(r, day))
        .flatMap((r) => r.customerIds)
        .filter(() => rand() < 0.85);
      if (rand() < 0.2) todays.push(pick(repCustomers).id);
      for (const customerId of [...new Set(todays)]) {
        const customer = repCustomers.find((c) => c.id === customerId)!;
        const roll = rand();
        const isOrder = customer.status === 'ACTIVE' && roll < 0.7;
        const needsFollowUp = !isOrder && roll < 0.85;

        const visit = await prisma.visitLog.create({
          data: {
            organizationId,
            salespersonId: userId(repName),
            customerId: customer.id,
            dateOfVisit: dateCol(day),
            visitOutcome: isOrder
              ? OUTCOMES.order
              : needsFollowUp
                ? OUTCOMES.followUp
                : OUTCOMES.visit,
            nextFollowUpDate: needsFollowUp ? dateCol(addDays(day, randInt(3, 14))) : null,
            remarks: needsFollowUp ? 'Follow up on pricing and stock levels' : null,
            createdAt: new Date(`${day}T08:00:00.000Z`),
          },
        });
        visitCount++;
        if (!isOrder) continue;

        // 1-3 products, usually including the customer's main product
        const chosen = new Set([rand() < 0.7 ? customer.productName : pick(productNames)]);
        const extra = randInt(0, 2);
        for (let k = 0; k < extra; k++) chosen.add(pick(productNames));
        const [minQty, maxQty] = ORDER_QTY[customer.category] ?? [10, 40];
        const lines = [...chosen].map((name, idx) => ({
          productId: products.get(name)!.id,
          quantity:
            idx === 0
              ? randInt(minQty, maxQty)
              : randInt(Math.ceil(minQty / 3), Math.ceil(maxQty / 3)),
          unitPrice: priceOf(name, customer.priceList),
          unitWeightKg: PRODUCTS.find((p) => p.name === name)!.weightKg,
        }));
        const totals = computeOrderTotals(lines, 18, true);

        // Recent orders are still open; one recent order is on credit hold
        const age = Math.round((dateCol(today).getTime() - dateCol(day).getTime()) / 86400000);
        let status: OrderStatus = age > 4 ? 'DELIVERED' : 'CONFIRMED';
        if (status === 'CONFIRMED' && !heldOnce && customer.terms > 0) {
          status = 'PENDING_APPROVAL';
          heldOnce = true;
        }
        const deliveredOn = status === 'DELIVERED' ? addDays(day, randInt(0, 2)) : null;

        const order = await prisma.salesOrder.create({
          data: {
            organizationId,
            orderNumber: docNo('SALES_ORDER', 'SO'),
            customerId: customer.id,
            salespersonId: userId(repName),
            visitLogId: visit.id,
            orderDate: dateCol(day),
            status,
            holdReason: status === 'PENDING_APPROVAL' ? 'Credit limit exceeded (demo data)' : null,
            paymentTermsDays: customer.terms,
            subtotal: totals.subtotal,
            vatAmount: totals.vatAmount,
            total: totals.total,
            createdById: userId(repName),
            deliveredById: deliveredOn ? userId('Gakuba Samson') : null,
            deliveredAt: deliveredOn ? new Date(`${deliveredOn}T12:00:00.000Z`) : null,
            createdAt: new Date(`${day}T08:30:00.000Z`),
            lines: { create: lines.map((l, idx) => ({ ...l, lineTotal: totals.lineTotals[idx] })) },
          },
        });
        orderCount++;
        const stockLines = lines.map((l) => ({ productId: l.productId, quantity: l.quantity }));
        if (!deliveredOn) {
          openOrders.push({ orderId: order.id, status, lines: stockLines });
          continue;
        }
        deliveredLog.push({ orderId: order.id, deliveredOn, lines: stockLines });

        const dueDate = addDays(deliveredOn, customer.terms);
        const invoice = await prisma.invoice.create({
          data: {
            organizationId,
            invoiceNumber: docNo('INVOICE', 'INV'),
            orderId: order.id,
            customerId: customer.id,
            issueDate: dateCol(deliveredOn),
            dueDate: dateCol(dueDate),
            vatRate: 18,
            subtotal: totals.subtotal,
            vatAmount: totals.vatAmount,
            total: totals.total,
            ebmReceiptNumber: rand() < 0.8 ? `EBM-${randInt(100000, 999999)}` : null,
          },
        });

        // Cash customers pay on delivery; credit customers mostly pay near the due date,
        // some pay part, and a few recent ones are still unpaid or overdue.
        const pay = (amount: number, paidOn: string) =>
          prisma.payment.create({
            data: {
              organizationId,
              paymentNumber: docNo('PAYMENT', 'RCT'),
              invoiceId: invoice.id,
              customerId: customer.id,
              amount,
              method:
                customer.terms === 0
                  ? pick(['CASH', 'MTN_MOMO'] as PaymentMethod[])
                  : pick(methods),
              reference: `TX${randInt(10000000, 99999999)}`,
              paidOn: dateCol(paidOn > today ? today : paidOn),
              receivedById: customer.terms === 0 ? userId('Gakuba Samson') : userId(repName),
            },
          });
        const payRoll = rand();
        if (customer.terms === 0) {
          await pay(totals.total, deliveredOn);
        } else if (dueDate < addDays(today, -45) || payRoll < 0.55) {
          const paidOn = addDays(deliveredOn, randInt(5, customer.terms));
          if (paidOn <= today) await pay(totals.total, paidOn);
        } else if (payRoll < 0.75) {
          await pay(Math.round(totals.total * 0.5), addDays(deliveredOn, 3));
        }
      }
    }
  }
  // 10. Stock. One warehouse; green coffee bought in lots; a roast run each week sized to that
  // week's roasted-coffee demand (+15%); instant and pods bought in. Every delivery then takes
  // stock oldest-batch-first, exactly as the app does, so the ledger and balances are consistent.
  const warehouse = await prisma.warehouse.create({
    data: {
      organizationId,
      name: 'Main Warehouse',
      address: 'Kigali Special Economic Zone, Gasabo',
      isDefault: true,
    },
  });
  const warehouseStaff = userId('Herve Ndayisaba');
  const driverId = userId('Gakuba Samson');
  const productById = new Map(PRODUCTS.map((p) => [products.get(p.name)!.id, p]));
  const greenId = products.get('Green Coffee Beans')!.id;

  type SimBatch = {
    id: string;
    productId: string;
    quantity: number;
    roastDate: string | null;
    bestBefore: string | null;
    receivedOn: string;
  };
  const simBatches: SimBatch[] = [];
  const movements: Prisma.StockMovementCreateManyInput[] = [];
  const at = (date: string, hour: number) =>
    new Date(`${date}T${String(hour).padStart(2, '0')}:00:00.000Z`);

  const addBatch = async (
    productId: string,
    batchNumber: string,
    quantity: number,
    date: string,
    opts: { roastRunId?: string; supplier?: string; type: StockMovementType; roasted?: boolean }
  ) => {
    const meta = productById.get(productId)!;
    const roastDate = opts.roasted ? date : null;
    const bestBefore = meta.shelfLifeDays ? addDays(date, meta.shelfLifeDays) : null;
    const batch = await prisma.stockBatch.create({
      data: {
        organizationId,
        warehouseId: warehouse.id,
        productId,
        batchNumber,
        receivedOn: dateCol(date),
        roastDate: roastDate ? dateCol(roastDate) : null,
        bestBefore: bestBefore ? dateCol(bestBefore) : null,
        quantityOnHand: 0,
        supplier: opts.supplier ?? null,
        roastRunId: opts.roastRunId ?? null,
      },
    });
    simBatches.push({ id: batch.id, productId, quantity, roastDate, bestBefore, receivedOn: date });
    movements.push({
      organizationId,
      batchId: batch.id,
      type: opts.type,
      quantity,
      roastRunId: opts.roastRunId ?? null,
      reason: opts.type === 'RECEIPT' ? `Purchase from ${opts.supplier ?? 'supplier'}` : null,
      createdById: warehouseStaff,
      createdAt: at(date, 7),
    });
  };
  const usable = (productId: string, onDate: string) =>
    simBatches
      .filter((b) => b.productId === productId && (!b.bestBefore || b.bestBefore >= onDate))
      .reduce((s, b) => s + b.quantity, 0);
  const take = (
    productId: string,
    quantity: number,
    onDate: string,
    type: StockMovementType,
    refs: { orderId?: string; roastRunId?: string; deliveryRunId?: string },
    createdById: string
  ) => {
    const { allocations, shortfall } = allocateFifo(
      simBatches.filter((b) => b.productId === productId),
      quantity,
      onDate
    );
    if (shortfall > 0)
      throw new Error(`Seed stock short: ${productById.get(productId)?.name} on ${onDate}`);
    for (const a of allocations) {
      simBatches.find((b) => b.id === a.batchId)!.quantity = round3(
        simBatches.find((b) => b.id === a.batchId)!.quantity - a.quantity
      );
      movements.push({
        organizationId,
        batchId: a.batchId,
        type,
        quantity: -a.quantity,
        ...refs,
        createdById,
        createdAt: at(onDate, 9),
      });
    }
  };
  const demandBetween = (from: string, to: string) => {
    const d = new Map<string, number>();
    deliveredLog
      .filter((o) => o.deliveredOn >= from && o.deliveredOn < to)
      .forEach((o) =>
        o.lines.forEach((l) => d.set(l.productId, (d.get(l.productId) ?? 0) + l.quantity))
      );
    return d;
  };

  const roast = async (date: string, outputs: Map<string, number>) => {
    const outputKg = round3(
      [...outputs].reduce((s, [id, q]) => s + q * productById.get(id)!.weightKg, 0)
    );
    if (outputKg <= 0) return;
    const greenKg = Math.ceil((outputKg / ROAST_YIELD) * 10) / 10;
    if (usable(greenId, date) < greenKg) {
      await addBatch(greenId, `GL-${date}`, Math.ceil(greenKg * 4), date, {
        type: 'RECEIPT',
        supplier: pick(['Musasa Washing Station', 'Huye Mountain Coffee', 'Kopakama Cooperative']),
      });
    }
    const runNumber = `RR-${String(++seq.ROAST_RUN).padStart(6, '0')}`;
    const run = await prisma.roastRun.create({
      data: {
        organizationId,
        runNumber,
        warehouseId: warehouse.id,
        roastDate: dateCol(date),
        greenInputKg: greenKg,
        outputKg,
        createdById: warehouseStaff,
        createdAt: at(date, 6),
      },
    });
    take(greenId, greenKg, date, 'ROAST_INPUT', { roastRunId: run.id }, warehouseStaff);
    for (const [productId, qty] of outputs) {
      await addBatch(productId, runNumber, qty, date, {
        type: 'ROAST_OUTPUT',
        roastRunId: run.id,
        roasted: true,
      });
    }
  };

  // Restocks a week's demand (+15%) on its first day, then replays that week's deliveries
  const restock = async (date: string, demand: Map<string, number>) => {
    const need = (productId: string, qty: number) =>
      Math.ceil(qty * 1.15 - usable(productId, date));
    // Roast first (it consumes green coffee), then buy whatever is still short, incl. green sold as-is
    const roastOut = new Map<string, number>();
    for (const [productId, qty] of demand) {
      if (productById.get(productId)!.category === 'Roasted Coffee' && need(productId, qty) > 0)
        roastOut.set(productId, need(productId, qty));
    }
    await roast(date, roastOut);
    for (const [productId, qty] of demand) {
      const meta = productById.get(productId)!;
      if (meta.category === 'Roasted Coffee' || need(productId, qty) <= 0) continue;
      await addBatch(productId, `PO-${date}-${meta.sku}`, need(productId, qty), date, {
        type: 'RECEIPT',
        supplier: meta.kind === 'GREEN' ? 'Musasa Washing Station' : 'Regional distributor',
      });
    }
  };

  for (let week = startDate; week <= today; week = addDays(week, 7)) {
    const weekEnd = addDays(week, 7);
    await restock(week, demandBetween(week, weekEnd));
    for (const o of deliveredLog.filter((d) => d.deliveredOn >= week && d.deliveredOn < weekEnd)) {
      o.lines.forEach((l) =>
        take(l.productId, l.quantity, o.deliveredOn, 'DELIVERY', { orderId: o.orderId }, driverId)
      );
    }
  }
  // Make sure today's open orders can be covered (so the demo shows a dispatchable run)
  const openDemand = new Map<string, number>();
  openOrders.forEach((o) =>
    o.lines.forEach((l) =>
      openDemand.set(l.productId, (openDemand.get(l.productId) ?? 0) + l.quantity)
    )
  );
  await restock(today, openDemand);

  await prisma.stockMovement.createMany({ data: movements });
  for (const b of simBatches) {
    await prisma.stockBatch.update({ where: { id: b.id }, data: { quantityOnHand: b.quantity } });
  }

  // A planned delivery run for today's confirmed orders
  const confirmed = openOrders.filter((o) => o.status === 'CONFIRMED');
  if (confirmed.length) {
    const run = await prisma.deliveryRun.create({
      data: {
        organizationId,
        runNumber: `DR-${String(++seq.DELIVERY_RUN).padStart(6, '0')}`,
        runDate: dateCol(today),
        warehouseId: warehouse.id,
        driverId,
        vehicle: 'RAD 482 C',
        createdById: warehouseStaff,
      },
    });
    await prisma.salesOrder.updateMany({
      where: { id: { in: confirmed.map((o) => o.orderId) } },
      data: { deliveryRunId: run.id },
    });
  }

  // 10b. Returns & credit notes: an approved resellable return on a paid invoice (refunded),
  // an approved price correction on an unpaid invoice, and a damaged-goods return awaiting approval
  const managerId = userId('Mugabe Eric');
  const recentInvoices = await prisma.invoice.findMany({
    where: { organizationId, issueDate: { gte: dateCol(addDays(today, -40)), lte: dateCol(addDays(today, -5)) } },
    include: { order: { include: { lines: { include: { product: { select: { name: true } } } } } }, payments: true },
    orderBy: { issueDate: 'asc' },
  });
  const paidOf = (i: (typeof recentInvoices)[number]) => i.payments.reduce((s, p) => s + Number(p.amount), 0);
  const fullyPaid = recentInvoices.find((i) => paidOf(i) >= Number(i.total) && i.order.lines.some((l) => Number(l.quantity) >= 4));
  const unpaid = recentInvoices.find((i) => i.id !== fullyPaid?.id && paidOf(i) === 0);
  const another = recentInvoices.find((i) => i.id !== fullyPaid?.id && i.id !== unpaid?.id && i.order.lines.some((l) => Number(l.quantity) >= 2));
  const createCreditNote = async (
    invoice: (typeof recentInvoices)[number],
    qty: number,
    disposition: 'RESTOCK' | 'WRITE_OFF' | 'NOT_RETURNED',
    approved: boolean,
    reason: string
  ) => {
    const line = invoice.order.lines.find((l) => Number(l.quantity) >= qty)!;
    const totals = computeOrderTotals([{ quantity: qty, unitPrice: Number(line.unitPrice) }], 18, true);
    const issueDate = addDays(dateColumnString(invoice.issueDate), 3);
    const note = await prisma.creditNote.create({
      data: {
        organizationId,
        creditNoteNumber: approved ? `CN-${String(++seq.CREDIT_NOTE).padStart(6, '0')}` : null,
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        status: approved ? 'APPROVED' : 'PENDING_APPROVAL',
        reason,
        issueDate: approved ? dateCol(issueDate) : null,
        subtotal: totals.subtotal,
        vatAmount: totals.vatAmount,
        total: totals.total,
        createdById: invoice.order.salespersonId,
        approvedById: approved ? managerId : null,
        approvedAt: approved ? at(issueDate, 10) : null,
        createdAt: at(addDays(dateColumnString(invoice.issueDate), 2), 9),
        lines: { create: [{ orderLineId: line.id, quantity: qty, unitPrice: line.unitPrice, lineTotal: totals.total, disposition }] },
      },
    });
    if (approved && disposition === 'RESTOCK') {
      const out = await prisma.stockMovement.findFirst({
        where: { orderId: invoice.orderId, type: 'DELIVERY', batch: { productId: line.productId } },
      });
      if (out) {
        await prisma.stockBatch.update({ where: { id: out.batchId }, data: { quantityOnHand: { increment: qty } } });
        await prisma.stockMovement.create({
          data: { organizationId, batchId: out.batchId, type: 'CUSTOMER_RETURN', quantity: qty, orderId: invoice.orderId, creditNoteId: note.id, reason: `Customer return ${note.creditNoteNumber}: ${reason}`, createdById: managerId, createdAt: at(issueDate, 10) },
        });
      }
    }
    return { note, total: totals.total, issueDate };
  };
  if (fullyPaid) {
    const { note, total, issueDate } = await createCreditNote(fullyPaid, 2, 'RESTOCK', true, 'Ordered too much; unopened packs returned');
    await prisma.refund.create({
      data: { organizationId, refundNumber: `RF-${String(++seq.REFUND).padStart(6, '0')}`, creditNoteId: note.id, customerId: fullyPaid.customerId, amount: total, method: 'MTN_MOMO', reference: 'MP-RF-20481', paidOn: dateCol(issueDate), paidById: managerId },
    });
  }
  if (unpaid) await createCreditNote(unpaid, 1, 'NOT_RETURNED', true, 'Price agreed was lower than invoiced');
  if (another) await createCreditNote(another, 2, 'WRITE_OFF', false, 'Bags torn during delivery');

  await prisma.documentSequence.createMany({
    data: (Object.keys(seq) as DocumentType[]).map((type) => ({
      organizationId,
      type,
      lastNumber: seq[type],
    })),
  });

  // 11. Commission rules
  await prisma.commissionRule.createMany({
    data: [
      {
        organizationId,
        name: 'Base Commission',
        ruleType: 'percentage',
        value: 2,
        thresholdPct: 0,
        description: 'Earned on all sales regardless of target',
        sortOrder: 1,
      },
      {
        organizationId,
        name: 'Target Bonus',
        ruleType: 'percentage',
        value: 3,
        thresholdPct: 100,
        description: 'Extra % when monthly target is fully met',
        sortOrder: 2,
      },
      {
        organizationId,
        name: 'Stretch Bonus',
        ruleType: 'percentage',
        value: 1.5,
        thresholdPct: 120,
        description: 'Additional % for exceeding target by 20%',
        sortOrder: 3,
      },
      {
        organizationId,
        name: 'Top Performer Bonus',
        ruleType: 'flat',
        value: 50000,
        thresholdPct: 150,
        description: 'Flat RWF bonus for 150%+ achievement',
        sortOrder: 4,
      },
    ],
  });

  // 12. Example custom field
  await prisma.customFieldDefinition.create({
    data: {
      organizationId,
      entityType: 'CUSTOMER',
      name: 'Coffee Machine Type',
      fieldKey: 'coffee_machine_type',
      fieldType: FieldType.SELECT,
      options: ['Espresso', 'Filter', 'Capsule', 'None'],
    },
  });

  console.log(
    `✅ Seeded ${TEAM.length} users, ${customers.length} customers, ${DEALS.length} deals, ${visitCount} visits, ${orderCount} orders, ` +
      `${seq.ROAST_RUN} roast runs, ${simBatches.length} stock batches, ${movements.length} stock movements.`
  );
  console.log(
    '   Log in with any seeded email (e.g. eric.m@gorillacoffee.rw) and SEED_USER_PASSWORD.'
  );
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e.message ?? e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
