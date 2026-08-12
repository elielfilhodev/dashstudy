import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createGoalSchema,
  updateGoalSchema,
  type CreateGoalInput,
} from '../../common/schemas';
import { GoalsService } from './goals.service';

@Controller('goals')
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Get()
  list(@CurrentUser() userId: string) {
    return this.goals.list(userId);
  }

  @Post()
  create(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(createGoalSchema)) body: CreateGoalInput,
  ) {
    return this.goals.create(userId, body);
  }

  @Patch(':id')
  updateProgress(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateGoalSchema)) body: { done: number },
  ) {
    return this.goals.updateProgress(userId, id, body.done);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.goals.remove(userId, id);
  }
}
