import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { completeTaskSchema } from '../../common/schemas';
import { GamificationService } from './gamification.service';

@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  @Get()
  get(@CurrentUser() userId: string) {
    return this.gamification.get(userId);
  }

  @Post()
  @HttpCode(200)
  async completeTask(@CurrentUser() userId: string, @Body() body: unknown) {
    // Corpo inválido é ignorado em silêncio, como nas rotas atuais.
    const parsed = completeTaskSchema.safeParse(body);
    if (!parsed.success) return { skipped: true };
    return this.gamification.completeTask(userId, parsed.data.taskId);
  }
}
