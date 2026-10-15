import {
  BadRequestException,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import {
  CreateImportResponse,
  ImportDetail,
  ImportErrorItem,
  ImportSummary,
  Paginated,
} from '@jobflow/contracts';
import { parsePageParams } from '../common/pagination';
import { CsvValidationError } from './csv-inspector';
import { ImportsService, UploadedCsvFile } from './imports.service';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

@ApiTags('imports')
@Controller('imports')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post()
  @HttpCode(202)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  async create(@UploadedFile() file?: UploadedCsvFile): Promise<CreateImportResponse> {
    if (!file) {
      throw new BadRequestException('A CSV file is required in the "file" field');
    }
    try {
      return await this.imports.createFromUpload(file);
    } catch (error) {
      if (error instanceof CsvValidationError) {
        throw new BadRequestException({ code: error.code, message: error.message });
      }
      throw error;
    }
  }

  @Get()
  getHistory(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<Paginated<ImportSummary>> {
    return this.imports.getHistory(parsePageParams(page, pageSize));
  }

  @Get(':id')
  getDetail(@Param('id') id: string): Promise<ImportDetail> {
    return this.imports.getDetail(id);
  }

  @Get(':id/errors')
  getErrors(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<Paginated<ImportErrorItem>> {
    return this.imports.getErrors(id, parsePageParams(page, pageSize));
  }

  @Get(':id/errors.csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="import-errors.csv"')
  getErrorsCsv(@Param('id') id: string): Promise<string> {
    return this.imports.getErrorsCsv(id);
  }

  @Post(':id/retry')
  @HttpCode(202)
  retry(@Param('id') id: string): Promise<CreateImportResponse> {
    return this.imports.retry(id);
  }
}
