import { Controller, Get } from '@nestjs/common';
import { Public, SkipEnvelope } from '../../common/decorators';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @SkipEnvelope()
  @Get('health')
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  }
}
