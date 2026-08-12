import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { CreateBookInput, UpdateBookInput } from '../../common/schemas';
import {
  bookListSelect,
  isValidHttpCoverUrl,
  serializeBookListItem,
} from '../../common/utils/serialize';
import { FriendsService } from '../friends/friends.service';

export const COVER_MAX_BYTES = 1_500_000;
const COVER_ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const commentSelect = {
  id: true,
  body: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      name: true,
      username: true,
      displayId: true,
      image: true,
    },
  },
} as const;

type CommentRow = {
  id: string;
  body: string;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    username: string | null;
    displayId: string;
    image: string | null;
  };
};

function serializeComment(comment: CommentRow) {
  return {
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    user: {
      id: comment.user.id,
      name: comment.user.name ?? 'Usuário',
      username: comment.user.username,
      displayId: comment.user.displayId,
      image: comment.user.image,
    },
  };
}

type BookAccess = { access: 'owner' | 'friend'; ownerId: string };

@Injectable()
export class BooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly friends: FriendsService,
  ) {}

  async list(userId: string) {
    const books = await this.prisma.book.findMany({
      where: { userId },
      select: bookListSelect,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
    return books.map((book) => serializeBookListItem(book));
  }

  async create(userId: string, input: CreateBookInput) {
    const { coverUrl, ...rest } = input;
    if (!isValidHttpCoverUrl(coverUrl)) {
      throw new BadRequestException(
        'URL da capa deve começar com http:// ou https://',
      );
    }

    const book = await this.prisma.book.create({
      data: { ...rest, userId, coverUrl: coverUrl?.trim() || null },
      select: bookListSelect,
    });
    return serializeBookListItem(book);
  }

  async detail(userId: string, bookId: string) {
    const access = await this.access(bookId, userId);
    if (!access) throw new NotFoundException('Livro não encontrado');

    if (access.access === 'owner') {
      const book = await this.prisma.book.findUnique({
        where: { id: bookId },
        select: {
          ...bookListSelect,
          review: true,
          notes: {
            orderBy: { createdAt: 'desc' },
            select: { id: true, body: true, createdAt: true },
          },
          comments: { orderBy: { createdAt: 'asc' }, select: commentSelect },
        },
      });
      if (!book) throw new NotFoundException('Livro não encontrado');

      return {
        role: 'owner' as const,
        book: {
          ...serializeBookListItem(book),
          review: book.review,
          notes: book.notes.map((note) => ({
            id: note.id,
            body: note.body,
            createdAt: note.createdAt.toISOString(),
          })),
          comments: book.comments.map(serializeComment),
        },
      };
    }

    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: {
        ...bookListSelect,
        review: true,
        comments: { orderBy: { createdAt: 'asc' }, select: commentSelect },
      },
    });
    if (!book) throw new NotFoundException('Livro não encontrado');

    return {
      role: 'friend' as const,
      book: {
        ...serializeBookListItem(
          { ...book, _count: { notes: 0, comments: book._count.comments } },
          { hideNotesCount: true },
        ),
        review: book.review,
        comments: book.comments.map(serializeComment),
      },
    };
  }

  async update(userId: string, bookId: string, input: UpdateBookInput) {
    await this.assertOwner(bookId, userId);

    const touched = Object.entries(input).filter(
      ([, value]) => value !== undefined,
    );
    if (touched.length === 0)
      throw new BadRequestException('Nada para atualizar');

    if (input.coverUrl !== undefined && !isValidHttpCoverUrl(input.coverUrl)) {
      throw new BadRequestException(
        'URL da capa deve começar com http:// ou https://',
      );
    }

    const data = Object.fromEntries(touched) as UpdateBookInput;
    if (input.coverUrl !== undefined) {
      const trimmed = input.coverUrl?.trim() || null;
      Object.assign(data, {
        coverUrl: trimmed,
        // URL e upload são mutuamente exclusivos.
        ...(trimmed ? { coverBlob: null, coverMime: null } : {}),
      });
    }

    const updated = await this.prisma.book.update({
      where: { id: bookId },
      data,
      select: bookListSelect,
    });
    return serializeBookListItem(updated);
  }

  async remove(userId: string, bookId: string) {
    await this.assertOwner(bookId, userId);
    await this.prisma.book.delete({ where: { id: bookId } });
  }

  async getCover(userId: string, bookId: string) {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: { coverMime: true, coverBlob: true },
    });
    if (!book?.coverBlob || !book.coverMime)
      throw new NotFoundException('Capa não encontrada');

    const access = await this.access(bookId, userId);
    if (!access) throw new NotFoundException('Capa não encontrada');

    return { blob: Buffer.from(book.coverBlob), mime: book.coverMime };
  }

  async setCover(userId: string, bookId: string, file: Express.Multer.File) {
    await this.assertOwner(bookId, userId);

    if (!file)
      throw new BadRequestException('Envie um arquivo de imagem no campo file');
    if (!COVER_ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Use JPEG, PNG ou WebP');
    }
    if (file.size > COVER_MAX_BYTES) {
      throw new BadRequestException('Imagem muito grande (máx. ~1,5 MB)');
    }

    await this.prisma.book.update({
      where: { id: bookId },
      data: {
        coverBlob: file.buffer,
        coverMime: file.mimetype,
        coverUrl: null,
      },
    });
    return { ok: true };
  }

  async deleteCover(userId: string, bookId: string) {
    await this.assertOwner(bookId, userId);
    await this.prisma.book.update({
      where: { id: bookId },
      data: { coverBlob: null, coverMime: null },
    });
  }

  /** Anotações são privadas: só o dono cria e apaga. */
  async addNote(userId: string, bookId: string, body: string) {
    await this.assertOwner(bookId, userId);

    const note = await this.prisma.bookNote.create({
      data: { bookId, userId, body: body.trim() },
      select: { id: true, body: true, createdAt: true },
    });
    return { ...note, createdAt: note.createdAt.toISOString() };
  }

  async deleteNote(userId: string, bookId: string, noteId: string) {
    const note = await this.prisma.bookNote.findFirst({
      where: { id: noteId, bookId },
      select: { book: { select: { userId: true } } },
    });
    if (!note) throw new NotFoundException('Anotação não encontrada');
    if (note.book.userId !== userId)
      throw new ForbiddenException('Acesso negado');

    await this.prisma.bookNote.delete({ where: { id: noteId } });
  }

  /** Comentários são o inverso das anotações: só amigos comentam. */
  async addComment(userId: string, bookId: string, body: string) {
    const access = await this.access(bookId, userId);
    if (!access) throw new NotFoundException('Livro não encontrado');
    if (access.access === 'owner') {
      throw new BadRequestException(
        'Amigos comentam aqui; use anotações para lembretes pessoais',
      );
    }

    const comment = await this.prisma.bookComment.create({
      data: { bookId, userId, body: body.trim() },
      select: commentSelect,
    });
    return serializeComment(comment);
  }

  private async access(
    bookId: string,
    viewerId: string,
  ): Promise<BookAccess | null> {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: { userId: true },
    });
    if (!book) return null;
    if (book.userId === viewerId)
      return { access: 'owner', ownerId: book.userId };

    const areFriends = await this.friends.areFriends(viewerId, book.userId);
    return areFriends ? { access: 'friend', ownerId: book.userId } : null;
  }

  private async assertOwner(bookId: string, userId: string) {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: { userId: true },
    });
    if (!book) throw new NotFoundException('Livro não encontrado');
    if (book.userId !== userId) throw new ForbiddenException('Acesso negado');
  }
}
