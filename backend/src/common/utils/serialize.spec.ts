import {
  bookListSelect,
  isUserOnline,
  isValidHttpCoverUrl,
  serializeBookListItem,
} from './serialize';

describe('isUserOnline', () => {
  it('considera offline quem nunca foi visto', () => {
    expect(isUserOnline(null)).toBe(false);
  });

  it('considera online quem foi visto há menos de 5 minutos', () => {
    expect(isUserOnline(new Date(Date.now() - 4 * 60 * 1000))).toBe(true);
  });

  it('considera offline passados os 5 minutos', () => {
    expect(isUserOnline(new Date(Date.now() - 6 * 60 * 1000))).toBe(false);
  });
});

describe('bookListSelect', () => {
  it('nunca inclui coverBlob — listagens não carregam binários', () => {
    expect(bookListSelect).not.toHaveProperty('coverBlob');
  });
});

describe('serializeBookListItem', () => {
  const base = {
    id: 'book1',
    title: 'Clean Code',
    author: 'Robert Martin',
    isbn: null,
    rating: 5,
    coverUrl: null,
    coverMime: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    _count: { notes: 3, comments: 2 },
  };

  it('reporta ausência de capa quando não há URL nem upload', () => {
    const result = serializeBookListItem(base);
    expect(result.hasCover).toBe(false);
    expect(result.coverImageHref).toBeNull();
  });

  it('aponta para a rota de capa quando há upload', () => {
    const result = serializeBookListItem({ ...base, coverMime: 'image/png' });
    expect(result.hasCover).toBe(true);
    expect(result.coverImageHref).toBe('/api/books/book1/cover');
  });

  it('usa a URL externa quando não há upload', () => {
    const result = serializeBookListItem({
      ...base,
      coverUrl: 'https://exemplo.com/capa.jpg',
    });
    expect(result.coverImageHref).toBe('https://exemplo.com/capa.jpg');
  });

  it('prioriza o upload sobre a URL externa', () => {
    const result = serializeBookListItem({
      ...base,
      coverUrl: 'https://exemplo.com/capa.jpg',
      coverMime: 'image/png',
    });
    expect(result.coverImageHref).toBe('/api/books/book1/cover');
  });

  it('ignora URL só com espaços', () => {
    const result = serializeBookListItem({ ...base, coverUrl: '   ' });
    expect(result.hasCover).toBe(false);
    expect(result.coverImageHref).toBeNull();
  });

  it('esconde a contagem de anotações na visão de amigo', () => {
    const result = serializeBookListItem(base, { hideNotesCount: true });
    expect(result.notesCount).toBe(0);
    expect(result.commentsCount).toBe(2);
  });
});

describe('isValidHttpCoverUrl', () => {
  it.each([
    [null, true],
    [undefined, true],
    ['', true],
    ['   ', true],
    ['https://exemplo.com/a.png', true],
    ['http://exemplo.com/a.png', true],
    ['ftp://exemplo.com/a.png', false],
    ['javascript:alert(1)', false],
    ['/relativo.png', false],
  ])('%s → %s', (url, expected) => {
    expect(isValidHttpCoverUrl(url)).toBe(expected);
  });
});
