// Generate a 10,000-row valid product CSV for load and demo testing.
// Usage: node samples/generate-10k.mjs
import { writeFileSync } from 'node:fs';

const rows = ['sku,name,price,stock'];
for (let i = 1; i <= 10000; i++) {
  const sku = `BULK-${String(i).padStart(5, '0')}`;
  const price = (5 + Math.random() * 500).toFixed(2);
  const stock = Math.floor(Math.random() * 1000);
  rows.push(`${sku},Product ${i},${price},${stock}`);
}

writeFileSync(new URL('./products-10k.csv', import.meta.url), rows.join('\n') + '\n');
console.log('Wrote samples/products-10k.csv (10000 rows)');
