import { Controller, Get, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { gifSearchSchema } from '../../common/schemas';
import { GifsService } from './gifs.service';

@Controller('gifs')
export class GifsController {
  constructor(private readonly gifs: GifsService) {}

  @Get()
  search(
    @Query(new ZodValidationPipe(gifSearchSchema))
    query: {
      q: string;
      limit: number;
    },
  ) {
    return this.gifs.search(query.q, query.limit);
  }
}
