import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { SKIP_ENVELOPE } from '../decorators';

/** Envolve o retorno dos handlers em `{ data }`, mantendo o contrato das rotas atuais. */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ENVELOPE, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    return next
      .handle()
      .pipe(
        map((data: unknown) => (skip || data === undefined ? data : { data })),
      );
  }
}
