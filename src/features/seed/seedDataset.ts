import { addDaysIso, getDayOfWeekIndex, todayIsoDate } from '../../shared/utils/date';
import type { Product, StockMovement, Supplier } from '../inventory/inventory.types';
import type { RestockOrder } from '../restock/restock.types';
import type { SaleRecord } from '../sales/sales.types';
import type { ShopSettingsInput } from '../settings/settings.types';

export interface SeedBundle {
  shopSettings: ShopSettingsInput;
  suppliers: Supplier[];
  products: Product[];
  sales: SaleRecord[];
  restockOrders: RestockOrder[];
  stockMovements: StockMovement[];
}

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ProductSeedSpec {
  id: string;
  sku: string;
  name: string;
  category: Product['category'];
  unit: string;
  currentStock: number;
  onOrderQty: number;
  unitCost: number;
  sellingPrice: number;
  supplierId: string;
  leadTimeDays: number;
  safetyDays: number;
  packSize: number;
  isPerishable: boolean;
  shelfLifeDays: number | null;
  expiryOffsetDays: number | null;
  bulkUnitThreshold: number;
  baseDailyDemand: number;
  weekendBoost: number;
  trendFactor: number;
  intermittentRate?: number;
  bulkEvents?: Array<{ daysAgo: number; qty: number; note: string }>;
  promoDays?: Array<{ daysAgo: number; tag: string; lift: number }>;
  spikeDay?: { daysAgo: number; qty: number; note: string };
  dropDay?: { daysAgo: number; note: string };
}

const SUPPLIER_SPECS: Array<Omit<Supplier, 'createdAt' | 'updatedAt'>> = [
  {
    id: 'sup-valley-dairy',
    name: 'Valley Creamery & Bakery',
    contactName: 'Hannah Brooks',
    email: 'orders@valleycreamery.example',
    phone: '(555) 234-8810',
    defaultLeadTimeDays: 2,
    orderDays: ['Mon', 'Wed', 'Fri'],
    notes: 'Chilled van arrives 6:30 AM. 48-hour lead time on fresh milk and loaves.',
  },
  {
    id: 'sup-greenridge',
    name: 'Greenridge Produce Co-op',
    contactName: 'Mateo Alvarez',
    email: 'dispatch@greenridgecoop.example',
    phone: '(555) 391-4402',
    defaultLeadTimeDays: 1,
    orderDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    notes: 'Next-morning farm direct crates if ordered before 4 PM.',
  },
  {
    id: 'sup-harbor-drinks',
    name: 'Harbor Roasters & Drinks',
    contactName: 'Nadia Patel',
    email: 'wholesale@harborroasters.example',
    phone: '(555) 612-7740',
    defaultLeadTimeDays: 4,
    orderDays: ['Tue', 'Thu'],
    notes: 'Beverage cases ship in 12-unit or 24-unit trays.',
  },
  {
    id: 'sup-metro-dry',
    name: 'Metro Dry Goods & Paper',
    contactName: 'David Chen',
    email: 'fulfillment@metrodrygoods.example',
    phone: '(555) 804-1920',
    defaultLeadTimeDays: 6,
    orderDays: ['Mon'],
    notes: 'Weekly pallet drop on Mondays; 6-day lead time.',
  },
];

const PRODUCT_SPECS: ProductSeedSpec[] = [
  {
    id: 'prod-milk-1l',
    sku: 'DAIRY-MILK-1L',
    name: 'Whole Milk 1L',
    category: 'Dairy & Chilled',
    unit: 'carton',
    currentStock: 16,
    onOrderQty: 0,
    unitCost: 1.45,
    sellingPrice: 2.65,
    supplierId: 'sup-valley-dairy',
    leadTimeDays: 2,
    safetyDays: 2,
    packSize: 12,
    isPerishable: true,
    shelfLifeDays: 8,
    expiryOffsetDays: 5,
    bulkUnitThreshold: 20,
    baseDailyDemand: 10.5,
    weekendBoost: 1.35,
    trendFactor: 0.12,
    dropDay: { daysAgo: 18, note: 'Morning fridge restock delayed' },
  },
  {
    id: 'prod-sourdough',
    sku: 'BAK-SOUR-LOAF',
    name: 'Artisan Sourdough Loaf',
    category: 'Bakery',
    unit: 'loaf',
    currentStock: 6,
    onOrderQty: 0,
    unitCost: 2.4,
    sellingPrice: 5.5,
    supplierId: 'sup-valley-dairy',
    leadTimeDays: 2,
    safetyDays: 1,
    packSize: 6,
    isPerishable: true,
    shelfLifeDays: 3,
    expiryOffsetDays: 2,
    bulkUnitThreshold: 14,
    baseDailyDemand: 7.2,
    weekendBoost: 1.55,
    trendFactor: 0.15,
  },
  {
    id: 'prod-yogurt-500',
    sku: 'DAIRY-YOG-500',
    name: 'Greek Yogurt 500g',
    category: 'Dairy & Chilled',
    unit: 'tub',
    currentStock: 34,
    onOrderQty: 0,
    unitCost: 2.1,
    sellingPrice: 4.2,
    supplierId: 'sup-valley-dairy',
    leadTimeDays: 2,
    safetyDays: 2,
    packSize: 6,
    isPerishable: true,
    shelfLifeDays: 12,
    expiryOffsetDays: 2,
    bulkUnitThreshold: 16,
    baseDailyDemand: 5.4,
    weekendBoost: 1.15,
    trendFactor: 0.0,
  },
  {
    id: 'prod-eggs-12',
    sku: 'DAIRY-EGG-12',
    name: 'Free-Range Eggs (12pk)',
    category: 'Dairy & Chilled',
    unit: 'carton',
    currentStock: 60,
    onOrderQty: 0,
    unitCost: 2.8,
    sellingPrice: 5.25,
    supplierId: 'sup-valley-dairy',
    leadTimeDays: 2,
    safetyDays: 2,
    packSize: 10,
    isPerishable: true,
    shelfLifeDays: 18,
    expiryOffsetDays: 12,
    bulkUnitThreshold: 18,
    baseDailyDemand: 6.4,
    weekendBoost: 1.35,
    trendFactor: 0.05,
  },
  {
    id: 'prod-avocado-4',
    sku: 'PROD-AVO-4PK',
    name: 'Hass Avocados (4pk)',
    category: 'Fresh Produce',
    unit: 'pack',
    currentStock: 5,
    onOrderQty: 0,
    unitCost: 2.3,
    sellingPrice: 4.95,
    supplierId: 'sup-greenridge',
    leadTimeDays: 1,
    safetyDays: 1,
    packSize: 8,
    isPerishable: true,
    shelfLifeDays: 5,
    expiryOffsetDays: 3,
    bulkUnitThreshold: 14,
    baseDailyDemand: 6.8,
    weekendBoost: 1.4,
    trendFactor: 0.1,
  },
  {
    id: 'prod-spinach-250',
    sku: 'PROD-SPIN-250',
    name: 'Baby Spinach 250g',
    category: 'Fresh Produce',
    unit: 'bag',
    currentStock: 26,
    onOrderQty: 0,
    unitCost: 1.5,
    sellingPrice: 3.4,
    supplierId: 'sup-greenridge',
    leadTimeDays: 1,
    safetyDays: 1,
    packSize: 8,
    isPerishable: true,
    shelfLifeDays: 5,
    expiryOffsetDays: 5,
    bulkUnitThreshold: 15,
    baseDailyDemand: 5.1,
    weekendBoost: 1.25,
    trendFactor: -0.04,
    dropDay: { daysAgo: 12, note: 'Cold snap slowed salad sales' },
  },
  {
    id: 'prod-tomato-500',
    sku: 'PROD-TOM-500',
    name: 'Vine Tomatoes 500g',
    category: 'Fresh Produce',
    unit: 'punnet',
    currentStock: 34,
    onOrderQty: 0,
    unitCost: 1.65,
    sellingPrice: 3.6,
    supplierId: 'sup-greenridge',
    leadTimeDays: 1,
    safetyDays: 1,
    packSize: 8,
    isPerishable: true,
    shelfLifeDays: 6,
    expiryOffsetDays: 6,
    bulkUnitThreshold: 15,
    baseDailyDemand: 5.6,
    weekendBoost: 1.25,
    trendFactor: 0.04,
  },
  {
    id: 'prod-oat-milk',
    sku: 'BEV-OAT-1L',
    name: 'Oat Barista Milk 1L',
    category: 'Beverages',
    unit: 'carton',
    currentStock: 26,
    onOrderQty: 0,
    unitCost: 1.95,
    sellingPrice: 3.85,
    supplierId: 'sup-harbor-drinks',
    leadTimeDays: 4,
    safetyDays: 2,
    packSize: 12,
    isPerishable: false,
    shelfLifeDays: null,
    expiryOffsetDays: null,
    bulkUnitThreshold: 16,
    baseDailyDemand: 6.2,
    weekendBoost: 1.2,
    trendFactor: 0.28,
    bulkEvents: [
      { daysAgo: 42, qty: 24, note: 'B2B order: Corner Espresso Bar' },
      { daysAgo: 11, qty: 24, note: 'B2B order: Corner Espresso Bar' },
    ],
  },
  {
    id: 'prod-cold-brew',
    sku: 'BEV-BREW-330',
    name: 'Cold Brew Coffee 330ml',
    category: 'Beverages',
    unit: 'can',
    currentStock: 42,
    onOrderQty: 24,
    unitCost: 1.4,
    sellingPrice: 3.45,
    supplierId: 'sup-harbor-drinks',
    leadTimeDays: 4,
    safetyDays: 2,
    packSize: 12,
    isPerishable: false,
    shelfLifeDays: null,
    expiryOffsetDays: null,
    bulkUnitThreshold: 22,
    baseDailyDemand: 5.8,
    weekendBoost: 1.45,
    trendFactor: 0.14,
    spikeDay: { daysAgo: 9, qty: 16, note: 'Neighborhood street market foot traffic' },
  },
  {
    id: 'prod-sparkling-water',
    sku: 'BEV-SPARK-750',
    name: 'Sparkling Mineral Water 750ml',
    category: 'Beverages',
    unit: 'bottle',
    currentStock: 84,
    onOrderQty: 0,
    unitCost: 0.95,
    sellingPrice: 2.35,
    supplierId: 'sup-harbor-drinks',
    leadTimeDays: 4,
    safetyDays: 2,
    packSize: 12,
    isPerishable: false,
    shelfLifeDays: null,
    expiryOffsetDays: null,
    bulkUnitThreshold: 20,
    baseDailyDemand: 5.9,
    weekendBoost: 1.35,
    trendFactor: 0.06,
    promoDays: [
      { daysAgo: 26, tag: 'Weekend 20% Promo', lift: 1.85 },
      { daysAgo: 25, tag: 'Weekend 20% Promo', lift: 1.9 },
      { daysAgo: 5, tag: '2-for-1 Drinks', lift: 2.0 },
    ],
  },
  {
    id: 'prod-espresso-beans',
    sku: 'PAN-BEANS-1KG',
    name: 'Roasted Espresso Beans 1kg',
    category: 'Pantry Staples',
    unit: 'bag',
    currentStock: 36,
    onOrderQty: 0,
    unitCost: 11.5,
    sellingPrice: 21.0,
    supplierId: 'sup-harbor-drinks',
    leadTimeDays: 4,
    safetyDays: 3,
    packSize: 6,
    isPerishable: false,
    shelfLifeDays: null,
    expiryOffsetDays: null,
    bulkUnitThreshold: 8,
    baseDailyDemand: 1.8,
    weekendBoost: 1.25,
    trendFactor: 0.08,
    bulkEvents: [{ daysAgo: 21, qty: 12, note: 'Studio office kitchen restock' }],
  },
  {
    id: 'prod-olive-oil',
    sku: 'PAN-OLIVE-500',
    name: 'Extra Virgin Olive Oil 500ml',
    category: 'Pantry Staples',
    unit: 'bottle',
    currentStock: 34,
    onOrderQty: 0,
    unitCost: 5.8,
    sellingPrice: 11.5,
    supplierId: 'sup-metro-dry',
    leadTimeDays: 6,
    safetyDays: 3,
    packSize: 6,
    isPerishable: false,
    shelfLifeDays: null,
    expiryOffsetDays: null,
    bulkUnitThreshold: 8,
    baseDailyDemand: 1.9,
    weekendBoost: 1.15,
    trendFactor: 0.0,
    intermittentRate: 0.55,
    promoDays: [{ daysAgo: 32, tag: 'Pantry Sale 15%', lift: 1.7 }],
  },
  {
    id: 'prod-jasmine-rice',
    sku: 'PAN-RICE-2KG',
    name: 'Jasmine Rice 2kg',
    category: 'Pantry Staples',
    unit: 'bag',
    currentStock: 52,
    onOrderQty: 0,
    unitCost: 3.1,
    sellingPrice: 6.4,
    supplierId: 'sup-metro-dry',
    leadTimeDays: 6,
    safetyDays: 3,
    packSize: 8,
    isPerishable: false,
    shelfLifeDays: null,
    expiryOffsetDays: null,
    bulkUnitThreshold: 10,
    baseDailyDemand: 2.7,
    weekendBoost: 1.2,
    trendFactor: 0.04,
    bulkEvents: [{ daysAgo: 34, qty: 16, note: 'Community potluck bulk purchase' }],
  },
  {
    id: 'prod-crackers',
    sku: 'SNK-CRACK-200',
    name: 'Sea Salt Sourdough Crackers',
    category: 'Snacks',
    unit: 'box',
    currentStock: 22,
    onOrderQty: 0,
    unitCost: 1.85,
    sellingPrice: 4.1,
    supplierId: 'sup-metro-dry',
    leadTimeDays: 6,
    safetyDays: 2,
    packSize: 10,
    isPerishable: false,
    shelfLifeDays: null,
    expiryOffsetDays: null,
    bulkUnitThreshold: 20,
    baseDailyDemand: 3.4,
    weekendBoost: 1.4,
    trendFactor: 0.1,
    spikeDay: { daysAgo: 15, qty: 15, note: 'Cheese board weekend rush' },
  },
  {
    id: 'prod-dish-soap',
    sku: 'HH-DISH-750',
    name: 'Botanical Dishwashing Liquid 750ml',
    category: 'Household & Care',
    unit: 'bottle',
    currentStock: 32,
    onOrderQty: 0,
    unitCost: 2.2,
    sellingPrice: 4.75,
    supplierId: 'sup-metro-dry',
    leadTimeDays: 6,
    safetyDays: 3,
    packSize: 6,
    isPerishable: false,
    shelfLifeDays: null,
    expiryOffsetDays: null,
    bulkUnitThreshold: 8,
    baseDailyDemand: 1.5,
    weekendBoost: 1.1,
    trendFactor: 0.0,
    intermittentRate: 0.45,
  },
  {
    id: 'prod-paper-towels',
    sku: 'HH-TOWEL-4PK',
    name: 'Recycled Paper Towels (4pk)',
    category: 'Household & Care',
    unit: 'pack',
    currentStock: 48,
    onOrderQty: 0,
    unitCost: 3.3,
    sellingPrice: 6.9,
    supplierId: 'sup-metro-dry',
    leadTimeDays: 6,
    safetyDays: 3,
    packSize: 8,
    isPerishable: false,
    shelfLifeDays: null,
    expiryOffsetDays: null,
    bulkUnitThreshold: 10,
    baseDailyDemand: 2.1,
    weekendBoost: 1.15,
    trendFactor: 0.03,
    intermittentRate: 0.65,
  },
];

export function buildProductionSeedBundle(referenceToday: string = todayIsoDate()): SeedBundle {
  const rng = createRng(20261118);
  const timestamp = `${referenceToday}T08:00:00.000Z`;

  const suppliers: Supplier[] = SUPPLIER_SPECS.map((s) => ({
    ...s,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  const products: Product[] = PRODUCT_SPECS.map((spec) => ({
    id: spec.id,
    sku: spec.sku,
    name: spec.name,
    category: spec.category,
    unit: spec.unit,
    currentStock: spec.currentStock,
    onOrderQty: spec.onOrderQty,
    unitCost: spec.unitCost,
    sellingPrice: spec.sellingPrice,
    supplierId: spec.supplierId,
    leadTimeDays: spec.leadTimeDays,
    safetyDays: spec.safetyDays,
    packSize: spec.packSize,
    isPerishable: spec.isPerishable,
    shelfLifeDays: spec.shelfLifeDays,
    nearestExpiryDate:
      spec.expiryOffsetDays !== null ? addDaysIso(referenceToday, spec.expiryOffsetDays) : null,
    bulkUnitThreshold: spec.bulkUnitThreshold,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  const sales: SaleRecord[] = [];
  const totalHistoryDays = 90;

  for (const spec of PRODUCT_SPECS) {
    const promoByDay = new Map<number, { tag: string; lift: number }>();
    for (const p of spec.promoDays ?? []) {
      promoByDay.set(p.daysAgo, { tag: p.tag, lift: p.lift });
    }
    const bulkByDay = new Map<number, { qty: number; note: string }>();
    for (const b of spec.bulkEvents ?? []) {
      bulkByDay.set(b.daysAgo, { qty: b.qty, note: b.note });
    }

    for (let daysAgo = totalHistoryDays - 1; daysAgo >= 0; daysAgo -= 1) {
      const soldDate = addDaysIso(referenceToday, -daysAgo);
      const dow = getDayOfWeekIndex(soldDate);
      const isWeekend = dow === 5 || dow === 6;
      const isSunday = dow === 0;
      const progress = (totalHistoryDays - 1 - daysAgo) / (totalHistoryDays - 1);

      const promo = promoByDay.get(daysAgo);
      const bulk = bulkByDay.get(daysAgo);

      if (spec.dropDay && spec.dropDay.daysAgo === daysAgo) {
        sales.push({
          id: `seed_${spec.id}_${daysAgo}_drop`,
          productId: spec.id,
          sku: spec.sku,
          productName: spec.name,
          soldDate,
          quantity: 1,
          unitPrice: spec.sellingPrice,
          orderType: 'normal',
          isPromotion: false,
          promoTag: '',
          anomalyAction: 'auto',
          source: 'seed',
          notes: spec.dropDay.note,
          createdAt: timestamp,
        });
        continue;
      }

      if (spec.spikeDay && spec.spikeDay.daysAgo === daysAgo) {
        sales.push({
          id: `seed_${spec.id}_${daysAgo}_spike`,
          productId: spec.id,
          sku: spec.sku,
          productName: spec.name,
          soldDate,
          quantity: spec.spikeDay.qty,
          unitPrice: spec.sellingPrice,
          orderType: 'normal',
          isPromotion: false,
          promoTag: '',
          anomalyAction: 'auto',
          source: 'seed',
          notes: spec.spikeDay.note,
          createdAt: timestamp,
        });
      } else if (spec.intermittentRate !== undefined) {
        if (rng() <= spec.intermittentRate) {
          const intermittentQty = Math.max(
            1,
            Math.round(
              (spec.baseDailyDemand / spec.intermittentRate) *
                (promo ? promo.lift : 1) *
                (0.7 + rng() * 0.6),
            ),
          );
          sales.push({
            id: `seed_${spec.id}_${daysAgo}_n`,
            productId: spec.id,
            sku: spec.sku,
            productName: spec.name,
            soldDate,
            quantity: intermittentQty,
            unitPrice: promo ? Math.round(spec.sellingPrice * 0.85 * 100) / 100 : spec.sellingPrice,
            orderType: 'normal',
            isPromotion: Boolean(promo),
            promoTag: promo?.tag ?? '',
            anomalyAction: 'auto',
            source: 'seed',
            notes: promo ? `Promo: ${promo.tag}` : '',
            createdAt: timestamp,
          });
        }
      } else {
        const seasonalMult = isWeekend ? spec.weekendBoost : isSunday ? 0.92 : 0.9;
        const trendMult = 1 + spec.trendFactor * (progress - 0.5);
        const promoMult = promo ? promo.lift : 1;
        const noise = 0.84 + rng() * 0.32;
        const qty = Math.max(
          1,
          Math.round(spec.baseDailyDemand * seasonalMult * trendMult * promoMult * noise),
        );

        sales.push({
          id: `seed_${spec.id}_${daysAgo}_n`,
          productId: spec.id,
          sku: spec.sku,
          productName: spec.name,
          soldDate,
          quantity: qty,
          unitPrice: promo ? Math.round(spec.sellingPrice * 0.82 * 100) / 100 : spec.sellingPrice,
          orderType: 'normal',
          isPromotion: Boolean(promo),
          promoTag: promo?.tag ?? '',
          anomalyAction: 'auto',
          source: 'seed',
          notes: promo ? `Promo: ${promo.tag}` : '',
          createdAt: timestamp,
        });
      }

      if (bulk) {
        sales.push({
          id: `seed_${spec.id}_${daysAgo}_bulk`,
          productId: spec.id,
          sku: spec.sku,
          productName: spec.name,
          soldDate,
          quantity: bulk.qty,
          unitPrice: Math.round(spec.sellingPrice * 0.88 * 100) / 100,
          orderType: 'bulk',
          isPromotion: false,
          promoTag: '',
          anomalyAction: 'auto',
          source: 'seed',
          notes: bulk.note,
          createdAt: timestamp,
        });
      }
    }
  }

  const restockOrders: RestockOrder[] = [
    {
      id: 'po-seed-coldbrew',
      productId: 'prod-cold-brew',
      productName: 'Cold Brew Coffee 330ml',
      supplierId: 'sup-harbor-drinks',
      supplierName: 'Harbor Roasters & Drinks',
      quantity: 24,
      unitCost: 1.4,
      totalCost: 33.6,
      status: 'ordered',
      expectedDate: addDaysIso(referenceToday, 2),
      receivedDate: null,
      notes: '2 cases incoming after street market sell-through',
      createdAt: `${addDaysIso(referenceToday, -2)}T10:15:00.000Z`,
      updatedAt: `${addDaysIso(referenceToday, -2)}T10:15:00.000Z`,
    },
    {
      id: 'po-seed-milk-prev',
      productId: 'prod-milk-1l',
      productName: 'Whole Milk 1L',
      supplierId: 'sup-valley-dairy',
      supplierName: 'Valley Creamery & Bakery',
      quantity: 48,
      unitCost: 1.45,
      totalCost: 69.6,
      status: 'received',
      expectedDate: addDaysIso(referenceToday, -4),
      receivedDate: addDaysIso(referenceToday, -4),
      notes: 'Morning dairy delivery checked in at 6:40 AM',
      createdAt: `${addDaysIso(referenceToday, -6)}T09:00:00.000Z`,
      updatedAt: `${addDaysIso(referenceToday, -4)}T06:45:00.000Z`,
    },
  ];

  const stockMovements: StockMovement[] = [
    {
      id: 'mov-seed-milk-in',
      productId: 'prod-milk-1l',
      productName: 'Whole Milk 1L',
      delta: 48,
      previousStock: 12,
      newStock: 60,
      reason: 'restock_received',
      note: 'Valley Creamery delivery PO received',
      createdAt: `${addDaysIso(referenceToday, -4)}T06:45:00.000Z`,
    },
    {
      id: 'mov-seed-yogurt-spoil',
      productId: 'prod-yogurt-500',
      productName: 'Greek Yogurt 500g',
      delta: -2,
      previousStock: 36,
      newStock: 34,
      reason: 'spoilage',
      note: 'Two dented lids pulled during morning check',
      createdAt: `${addDaysIso(referenceToday, -1)}T07:30:00.000Z`,
    },
  ];

  return {
    shopSettings: {
      name: 'Cornerstone Provisions',
      currency: 'USD',
      serviceLevelTarget: 0.95,
      defaultReviewCycleDays: 7,
      bulkMultiplierThreshold: 3.5,
      browserAlertsEnabled: false,
    },
    suppliers,
    products,
    sales,
    restockOrders,
    stockMovements,
  };
}

/**
 * Generates a realistic "messy" POS CSV export containing whitespace, mixed date formats,
 * case-mismatched SKUs, a duplicate row, a negative void row, and a bulk café order
 * so shop owners can test the Data Cleaning Workbench immediately.
 */
export function buildMessySamplePosCsv(referenceToday: string = todayIsoDate()): string {
  const yesterday = addDaysIso(referenceToday, -1);
  const twoDaysAgo = addDaysIso(referenceToday, -2);
  const slashParts = twoDaysAgo.split('-');
  const slashDate = `${slashParts[1]}/${slashParts[2]}/${slashParts[0]}`;

  return [
    'date,sku,qty,unit_price,promo_tag,order_type,notes',
    `${yesterday},dairy-milk-1l,19,$2.65,,,Morning counter sales`,
    `${yesterday},DAIRY-MILK-1L,19,$2.65,,,Duplicate POS export line`,
    `${slashDate},Oat Barista Milk 1L,20,$3.40,,wholesale,Local cafe tray pickup`,
    `${yesterday},BEV-SPARK-750,14,$1.95,2-for-1 Drinks,,Promo endcap`,
    `${yesterday},BAK-SOUR-LOAF,-2,$5.50,,,Voided receipt error`,
    `bad-date,DAIRY-EGG-12,5,$5.25,,,Corrupted date cell`,
    `${yesterday},UNKNOWN-SKU-99,4,$3.00,,,Unmapped shelf item`,
    `${yesterday},PROD-AVO-4PK,13,,,,Missing price auto-filled`,
  ].join('\n');
}
