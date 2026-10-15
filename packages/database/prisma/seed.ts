import { prisma } from '../src/index';

/**
 * Seed a few demo Products. Idempotent: it upserts by SKU, so re-running never
 * duplicates rows (the same guarantee the importer relies on — ADR-0005).
 */
async function main(): Promise<void> {
  const products = [
    { sku: 'DEMO-001', name: 'Mechanical Keyboard', price: 49.9, stock: 120 },
    { sku: 'DEMO-002', name: 'Wireless Mouse', price: 19.9, stock: 300 },
    { sku: 'DEMO-003', name: '27-inch Monitor', price: 199.0, stock: 40 },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: { name: product.name, price: product.price, stock: product.stock },
      create: product,
    });
  }

  console.log(`Seeded ${products.length} products (idempotent upsert by SKU).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
