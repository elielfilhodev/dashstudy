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
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, SkipEnvelope } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { addFriendSchema, patchFriendSchema } from '../../common/schemas';
import { FriendProfileService } from './friend-profile.service';
import { FriendsService } from './friends.service';

@Controller('friends')
export class FriendsController {
  constructor(
    private readonly friends: FriendsService,
    private readonly profiles: FriendProfileService,
  ) {}

  @Get()
  list(@CurrentUser() userId: string) {
    return this.friends.list(userId);
  }

  @Post()
  @HttpCode(200)
  request(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(addFriendSchema)) body: { username: string },
  ) {
    return this.friends.request(userId, body.username);
  }

  @Get('profile/:friendId')
  profile(@CurrentUser() userId: string, @Param('friendId') friendId: string) {
    return this.profiles.profile(userId, friendId);
  }

  @Get('profile/:friendId/banner')
  @SkipEnvelope()
  async banner(
    @CurrentUser() userId: string,
    @Param('friendId') friendId: string,
    @Res() res: Response,
  ) {
    const banner = await this.profiles.banner(userId, friendId);
    if (!banner) {
      res.status(204).end();
      return;
    }
    res
      .setHeader('Content-Type', banner.mime)
      .setHeader('Cache-Control', 'private, max-age=3600')
      .send(banner.blob);
  }

  @Get('profile/:friendId/books')
  books(@CurrentUser() userId: string, @Param('friendId') friendId: string) {
    return this.profiles.books(userId, friendId);
  }

  @Patch(':id')
  async patch(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(patchFriendSchema))
    body: { action: 'accept' | 'reject' | 'block' },
    @Res({ passthrough: true }) res: Response,
  ) {
    if (body.action === 'accept') return this.friends.accept(userId, id);
    if (body.action === 'block') return this.friends.block(userId, id);

    await this.friends.remove(userId, id, 'Solicitação');
    res.status(204);
    return undefined;
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.friends.remove(userId, id);
  }
}
