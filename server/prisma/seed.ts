import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Farm ───────────────────────────────────────
  const farm = await prisma.farm.create({
    data: {
      name: 'Samruddhi Agros Farm',
      address: 'Samruddhi Agros, Maharashtra, India',
      latitude: 18.5204,
      longitude: 73.8567,
      serviceRadiusKm: 15,
    },
  });
  console.log('✅ Farm created:', farm.name);

  // ─── Super Admin ────────────────────────────────
  const passwordHash = await bcrypt.hash('admin@123', 12);
  const admin = await prisma.admin.create({
    data: {
      phone: '+919999999999',
      name: 'Super Admin',
      email: 'admin@samruddhiagros.com',
      passwordHash,
      role: 'SUPER_ADMIN',
    },
  });
  console.log('✅ Super Admin created:', admin.name);

  // ─── Products ───────────────────────────────────
  const productsData = [
    // Fruits
    { name: 'Mango (Alphonso)', category: 'Fruits', unit: 'kg', description: 'Premium Alphonso mangoes, naturally ripened on the tree.' },
    { name: 'Banana (Elaichi)', category: 'Fruits', unit: 'bunch', description: 'Sweet and aromatic Elaichi bananas, perfect for snacking.' },
    { name: 'Papaya', category: 'Fruits', unit: 'piece', description: 'Fresh farm papaya, rich in vitamins and minerals.' },
    // Vegetables
    { name: 'Tomato (Desi)', category: 'Vegetables', unit: 'kg', description: 'Organic desi tomatoes, perfect for curries and salads.' },
    { name: 'Onion', category: 'Vegetables', unit: 'kg', description: 'Fresh red onions, a kitchen essential.' },
    { name: 'Potato', category: 'Vegetables', unit: 'kg', description: 'Farm-fresh potatoes, versatile for all cooking.' },
    { name: 'Brinjal (Bharli Vangi)', category: 'Vegetables', unit: 'kg', description: 'Fresh brinjal, ideal for bharli vangi and curries.' },
    // Leafy Greens
    { name: 'Spinach (Palak)', category: 'Leafy Greens', unit: 'bunch', description: 'Fresh palak leaves, rich in iron and nutrients.' },
    { name: 'Methi (Fenugreek)', category: 'Leafy Greens', unit: 'bunch', description: 'Aromatic methi leaves for thepla and sabzi.' },
    // Farm Produce
    { name: 'Fresh Cow Milk', category: 'Farm Produce', unit: 'litre', description: 'Pure, unprocessed cow milk delivered daily.' },
  ];

  const variantWeights = [250, 500, 1000, 2000];
  const basePrices: Record<string, number> = {
    'Mango (Alphonso)': 400,
    'Banana (Elaichi)': 60,
    'Papaya': 50,
    'Tomato (Desi)': 40,
    'Onion': 30,
    'Potato': 35,
    'Brinjal (Bharli Vangi)': 45,
    'Spinach (Palak)': 30,
    'Methi (Fenugreek)': 25,
    'Fresh Cow Milk': 60,
  };

  for (const productData of productsData) {
    const product = await prisma.product.create({
      data: {
        ...productData,
        variants: {
          create: variantWeights.map((weight) => {
            const pricePerKg = basePrices[productData.name] || 50;
            const price = (pricePerKg * weight) / 1000;
            return {
              weightGrams: weight,
              price,
              discountPrice: null,
            };
          }),
        },
      },
    });

    // Create a batch for each product
    const today = new Date();
    const bestBefore = new Date(today);
    bestBefore.setDate(bestBefore.getDate() + 5);

    await prisma.batch.create({
      data: {
        productId: product.id,
        quantityKg: 50,
        remainingQtyKg: 50,
        harvestDate: today,
        bestBeforeDate: bestBefore,
        status: 'ACTIVE',
      },
    });

    console.log(`✅ Product seeded: ${product.name}`);
  }

  // ─── Pricing Rules ──────────────────────────────
  await prisma.pricingRule.createMany({
    data: [
      {
        ruleType: 'FREE_DELIVERY',
        minOrderValue: 100,
        deliveryCharge: 0,
        isActive: true,
        priority: 1,
      },
      {
        ruleType: 'DELIVERY_CHARGE',
        minOrderValue: 0,
        deliveryCharge: 30,
        isActive: true,
        priority: 0,
      },
      {
        ruleType: 'DISCOUNT',
        minOrderValue: 500,
        discountPercentage: 5,
        isActive: true,
        priority: 2,
      },
    ],
  });
  console.log('✅ Pricing rules seeded');

  console.log('\n🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
