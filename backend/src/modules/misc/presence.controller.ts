import { Controller, HttpCode, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('presence')
export class PresenceController {
  constructor(private readonly prisma: PrismaService) {}

  /** Heartbeat do cliente; "online" é derivado da recência de `lastSeenAt`. */
  @Post()
  @HttpCode(200)
  async touch(@CurrentUser() userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
    });
    return { ok: true };
  }
}
