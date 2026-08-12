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
  createAgendaItemSchema,
  updateAgendaItemSchema,
  type CreateAgendaItemInput,
  type UpdateAgendaItemInput,
} from '../../common/schemas';
import { AgendaService } from './agenda.service';

@Controller('agenda')
export class AgendaController {
  constructor(private readonly agenda: AgendaService) {}

  @Get()
  list(@CurrentUser() userId: string) {
    return this.agenda.list(userId);
  }

  @Post()
  create(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(createAgendaItemSchema))
    body: CreateAgendaItemInput,
  ) {
    return this.agenda.create(userId, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAgendaItemSchema))
    body: UpdateAgendaItemInput,
  ) {
    return this.agenda.update(userId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.agenda.remove(userId, id);
  }
}
