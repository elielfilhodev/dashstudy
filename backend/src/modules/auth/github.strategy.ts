import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile } from 'passport-github2';
import { ENV, type Env } from '../../common/config/env';

export type GithubProfile = {
  providerAccountId: string;
  email: string | null;
  name: string | null;
  username: string | null;
  image: string | null;
};

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(@Inject(ENV) env: Env) {
    super({
      clientID: env.GITHUB_CLIENT_ID ?? '',
      clientSecret: env.GITHUB_CLIENT_SECRET ?? '',
      callbackURL:
        env.GITHUB_CALLBACK_URL ??
        'http://localhost:4000/api/v1/auth/github/callback',
      scope: ['user:email'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): GithubProfile {
    return {
      providerAccountId: profile.id,
      email: profile.emails?.[0]?.value ?? null,
      name: profile.displayName ?? null,
      username: profile.username ?? null,
      image: profile.photos?.[0]?.value ?? null,
    };
  }
}
