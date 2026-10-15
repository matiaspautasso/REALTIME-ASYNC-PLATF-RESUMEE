import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Paginated, ProductListItem } from '@jobflow/contracts';
import { parsePageParams } from '../common/pagination';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sku') sku?: string,
  ): Promise<Paginated<ProductListItem>> {
    return this.products.list(parsePageParams(page, pageSize), sku);
  }
}
