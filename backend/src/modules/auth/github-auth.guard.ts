import {
  ExecutionContext,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ENV, type Env } from '../../common/config/env';

@Injectable()
export class GithubAuthGuard extends AuthGuard('github') {
  constructor(@Inject(ENV) private readonly env: Env) {
    super();
  }

  canActivate(ctx: ExecutionContext) {
    if (!this.env.GITHUB_CLIENT_ID || !this.env.GITHUB_CLIENT_SECRET) {
      throw new ServiceUnavailableException(
        'Login com GitHub não está configurado',
      );
    }
    return super.canActivate(ctx);
  }
}
