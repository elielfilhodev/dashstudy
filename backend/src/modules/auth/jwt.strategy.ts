import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ENV, type Env } from '../../common/config/env';

export type JwtPayload = { sub: string; typ?: string };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(ENV) env: Env) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.JWT_SECRET,
      algorithms: ['HS256'],
    });
  }

  validate(payload: JwtPayload): { id: string } | null {
    if (payload.typ && payload.typ !== 'access') return null;
    if (!payload.sub) return null;
    return { id: payload.sub };
  }
}
