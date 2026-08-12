import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ENV, type Env } from '../config/env';

/** Normaliza toda resposta de erro para `{ error: string }`, como o frontend espera. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(@Inject(ENV) private readonly env: Env) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      res.status(status).json({ error: this.messageOf(exception) });
      return;
    }

    this.logger.error(
      exception instanceof Error ? exception.stack : String(exception),
    );

    const message =
      !this.env.isProduction && exception instanceof Error
        ? exception.message
        : 'Erro interno do servidor';

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: message });
  }

  /**
   * `new BadRequestException('texto')` vira
   * `{ message: 'texto', error: 'Bad Request', statusCode: 400 }`, ou seja:
   * `message` guarda a mensagem real e `error` só o nome genérico do status.
   * Por isso `message` vem primeiro — invertida, a ordem descarta a mensagem.
   */
  private messageOf(exception: HttpException): string {
    const body = exception.getResponse();
    if (typeof body === 'string') return body;

    const record = body as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.length > 0) {
      return record.message;
    }
    if (Array.isArray(record.message) && record.message.length > 0) {
      return String(record.message[0]);
    }
    // Só sobra quando a exceção foi lançada com um objeto `{ error }` próprio.
    if (typeof record.error === 'string' && record.error.length > 0) {
      return record.error;
    }
    return exception.message;
  }
}
