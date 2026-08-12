import { ForbiddenException, NotFoundException } from '@nestjs/common';

/**
 * 404 quando o recurso não existe, 403 quando existe mas é de outro usuário —
 * mesmo contrato das rotas atuais do Next.js.
 */
export function assertOwnership(
  row: { userId: string } | null,
  userId: string,
  entity: string,
): void {
  if (!row) throw new NotFoundException(`${entity} não encontrado`);
  if (row.userId !== userId) throw new ForbiddenException('Acesso negado');
}
