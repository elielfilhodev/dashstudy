import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ENV, loadEnv } from './env';

@Global()
@Module({
  imports: [NestConfigModule.forRoot({ isGlobal: true })],
  providers: [{ provide: ENV, useFactory: () => loadEnv() }],
  exports: [ENV],
})
export class ConfigModule {}
