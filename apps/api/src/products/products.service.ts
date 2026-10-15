import { Injectable } from '@nestjs/common';
import { ProductListItem, Paginated } from '@jobflow/contracts';
import { Prisma, prisma, type Product } from '@jobflow/database';
import { PageParams, buildPaginated, toSkipTake } from '../common/pagination';

@Injectable()
export class ProductsService {
  async list(params: PageParams, sku?: string): Promise<Paginated<ProductListItem>> {
    const where: Prisma.ProductWhereInput = sku
      ? { sku: { contains: sku, mode: 'insensitive' } }
      : {};
    const { skip, take } = toSkipTake(params);
    const [rows, total] = await prisma.$transaction([
      prisma.product.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take }),
      prisma.product.count({ where }),
    ]);
    return buildPaginated(rows.map(toProductItem), total, params);
  }
}

function toProductItem(product: Product): ProductListItem {
  return {
    sku: product.sku,
    name: product.name,
    price: product.price.toNumber(),
    stock: product.stock,
    updatedAt: product.updatedAt.toISOString(),
  };
}
