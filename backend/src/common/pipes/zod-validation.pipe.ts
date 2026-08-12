import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Valida o corpo/query com um schema Zod e devolve o dado já tipado.
 * A primeira mensagem do Zod vira o `{ error }` da resposta 400.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(
        result.error.issues[0]?.message ?? 'Dados inválidos',
      );
    }
    return result.data;
  }
}
