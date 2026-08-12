import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import type { Env } from '../config/env';
import { AllExceptionsFilter } from './all-exceptions.filter';

function makeHost() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => res }),
  } as unknown as ArgumentsHost;
  return { host, res };
}

function env(isProduction: boolean): Env {
  return { isProduction } as Env;
}

function capture(exception: unknown, isProduction = false) {
  const { host, res } = makeHost();
  new AllExceptionsFilter(env(isProduction)).catch(exception, host);
  return {
    status: res.status.mock.calls[0][0] as number,
    body: res.json.mock.calls[0][0] as { error: string },
  };
}

describe('AllExceptionsFilter', () => {
  it('preserva a mensagem de uma HttpException criada com string', () => {
    const { status, body } = capture(
      new BadRequestException('Já existe uma conta com este e-mail'),
    );

    expect(status).toBe(400);
    expect(body).toEqual({ error: 'Já existe uma conta com este e-mail' });
  });

  it.each([
    [
      new UnauthorizedException('E-mail ou senha inválidos'),
      401,
      'E-mail ou senha inválidos',
    ],
    [new ForbiddenException('Acesso negado'), 403, 'Acesso negado'],
    [
      new NotFoundException('Livro não encontrado'),
      404,
      'Livro não encontrado',
    ],
  ])(
    'mantém status e mensagem de %s',
    (exception, expectedStatus, expectedMessage) => {
      const { status, body } = capture(exception);
      expect(status).toBe(expectedStatus);
      expect(body.error).toBe(expectedMessage);
    },
  );

  it('nunca devolve o nome genérico do status quando há mensagem própria', () => {
    // Regressão: a ordem de leitura antes preferia `error` ("Bad Request")
    // ao `message`, descartando a mensagem real da aplicação.
    const { body } = capture(
      new BadRequestException('Só é possível adicionar amigos'),
    );
    expect(body.error).not.toBe('Bad Request');
  });

  it('usa a primeira mensagem quando a exceção carrega um array', () => {
    const { body } = capture(
      new BadRequestException({ message: ['primeiro erro', 'segundo erro'] }),
    );
    expect(body.error).toBe('primeiro erro');
  });

  it('aceita exceção lançada com um objeto { error }', () => {
    const { body } = capture(
      new HttpException({ error: 'Erro personalizado' }, HttpStatus.CONFLICT),
    );
    expect(body.error).toBe('Erro personalizado');
  });

  it('aceita exceção cujo corpo é uma string pura', () => {
    const { body } = capture(
      new HttpException('Falha direta', HttpStatus.I_AM_A_TEAPOT),
    );
    expect(body.error).toBe('Falha direta');
  });

  it('expõe a mensagem de erros inesperados fora de produção', () => {
    const { status, body } = capture(new Error('conexão recusada'), false);
    expect(status).toBe(500);
    expect(body.error).toBe('conexão recusada');
  });

  it('esconde detalhes de erros inesperados em produção', () => {
    const { status, body } = capture(
      new Error('conexão recusada em 10.0.0.5:5432'),
      true,
    );
    expect(status).toBe(500);
    expect(body.error).toBe('Erro interno do servidor');
  });

  it('trata valores lançados que não são Error', () => {
    const { status, body } = capture('algo estranho', true);
    expect(status).toBe(500);
    expect(body.error).toBe('Erro interno do servidor');
  });
});
