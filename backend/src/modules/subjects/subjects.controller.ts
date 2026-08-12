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
  createSubjectSchema,
  updateSubjectProgressSchema,
  type CreateSubjectInput,
} from '../../common/schemas';
import { SubjectsService } from './subjects.service';

@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjects: SubjectsService) {}

  @Get()
  list(@CurrentUser() userId: string) {
    return this.subjects.list(userId);
  }

  @Post()
  create(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(createSubjectSchema)) body: CreateSubjectInput,
  ) {
    return this.subjects.create(userId, body);
  }

  @Patch(':id')
  updateProgress(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSubjectProgressSchema))
    body: { progress: number },
  ) {
    return this.subjects.updateProgress(userId, id, body.progress);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.subjects.remove(userId, id);
  }
}
