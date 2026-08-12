import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ENV, type Env } from '../../common/config/env';

type TenorResult = {
  id: string;
  title: string;
  media_formats: {
    gif?: { url: string };
    tinygif?: { url: string };
  };
};

@Injectable()
export class GifsService {
  private readonly logger = new Logger(GifsService.name);

  constructor(@Inject(ENV) private readonly env: Env) {}

  /** Proxy da Tenor para não expor a chave ao cliente. */
  async search(query: string, limit: number) {
    if (!this.env.TENOR_API_KEY) {
      throw new ServiceUnavailableException('TENOR_API_KEY não configurada');
    }

    const term = query.trim();
    if (!term) return [];

    const url = new URL('https://tenor.googleapis.com/v2/search');
    url.searchParams.set('q', term);
    url.searchParams.set('key', this.env.TENOR_API_KEY);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('media_filter', 'gif,tinygif');
    url.searchParams.set('contentfilter', 'medium');

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Tenor API error: ${res.status}`);

      const json = (await res.json()) as { results: TenorResult[] };

      return json.results
        .map((r) => ({
          id: r.id,
          title: r.title,
          url: r.media_formats.gif?.url ?? '',
          previewUrl:
            r.media_formats.tinygif?.url ?? r.media_formats.gif?.url ?? '',
        }))
        .filter((gif) => gif.url);
    } catch (err) {
      this.logger.error(`Busca de GIFs falhou: ${String(err)}`);
      return [];
    }
  }
}
