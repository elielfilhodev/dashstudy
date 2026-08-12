process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'segredo-de-teste-com-mais-de-32-caracteres-ok';
process.env.DATABASE_URL ??=
  'postgresql://test:test@localhost:55432/dashstudy_test?schema=public';
process.env.FRONTEND_URL ??= 'http://localhost:3000';
process.env.ALLOWED_ORIGINS ??= 'http://localhost:3000';

// Rate limit alto para não derrubar a suíte, que dispara muitas requisições seguidas.
process.env.RATE_LIMIT_PER_MINUTE ??= '100000';
process.env.AUTH_RATE_LIMIT_PER_MINUTE ??= '100000';
