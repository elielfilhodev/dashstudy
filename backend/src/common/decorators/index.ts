import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';

export const IS_PUBLIC = 'isPublic';
/** Libera a rota do guard JWT global. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const SKIP_ENVELOPE = 'skipEnvelope';
/** Retorna o corpo cru (binário, redirect) sem o envelope `{ data }`. */
export const SkipEnvelope = () => SetMetadata(SKIP_ENVELOPE, true);

/** Id do usuário autenticado, injetado pelo JwtStrategy. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { user?: { id: string } }>();
    return req.user!.id;
  },
);
