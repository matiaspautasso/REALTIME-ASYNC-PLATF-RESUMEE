import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthResult, HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  async get(): Promise<HealthResult> {
    const result = await this.health.check();
    if (!result.ok) {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }
}
