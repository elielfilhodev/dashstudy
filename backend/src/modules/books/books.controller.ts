import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser, SkipEnvelope } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createBookCommentSchema,
  createBookNoteSchema,
  createBookSchema,
  updateBookSchema,
  type CreateBookInput,
  type UpdateBookInput,
} from '../../common/schemas';
import { BooksService, COVER_MAX_BYTES } from './books.service';

@Controller('books')
export class BooksController {
  constructor(private readonly books: BooksService) {}

  @Get()
  list(@CurrentUser() userId: string) {
    return this.books.list(userId);
  }

  @Post()
  create(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(createBookSchema)) body: CreateBookInput,
  ) {
    return this.books.create(userId, body);
  }

  @Get(':id')
  detail(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.books.detail(userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateBookSchema)) body: UpdateBookInput,
  ) {
    return this.books.update(userId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.books.remove(userId, id);
  }

  @Get(':id/cover')
  @SkipEnvelope()
  async getCover(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const cover = await this.books.getCover(userId, id);
    res
      .setHeader('Content-Type', cover.mime)
      .setHeader('Cache-Control', 'private, max-age=86400')
      .send(cover.blob);
  }

  @Post(':id/cover')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: COVER_MAX_BYTES } }),
  )
  setCover(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.books.setCover(userId, id, file);
  }

  @Delete(':id/cover')
  @HttpCode(204)
  deleteCover(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.books.deleteCover(userId, id);
  }

  @Post(':id/notes')
  addNote(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createBookNoteSchema)) body: { body: string },
  ) {
    return this.books.addNote(userId, id, body.body);
  }

  @Delete(':id/notes/:noteId')
  @HttpCode(204)
  deleteNote(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Param('noteId') noteId: string,
  ) {
    return this.books.deleteNote(userId, id, noteId);
  }

  @Post(':id/comments')
  addComment(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createBookCommentSchema))
    body: { body: string },
  ) {
    return this.books.addComment(userId, id, body.body);
  }
}
