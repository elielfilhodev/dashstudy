import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { changePasswordSchema, updateUserSchema } from '../../common/schemas';
import type { UpdateUserInput } from '../../common/schemas';
import { BANNER_MAX_BYTES, UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('user')
  me(@CurrentUser() userId: string) {
    return this.users.me(userId);
  }

  @Patch('user')
  update(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserInput,
  ) {
    return this.users.update(userId, body);
  }

  @Get('user/banner')
  @SkipEnvelope()
  async getBanner(@CurrentUser() userId: string, @Res() res: Response) {
    const banner = await this.users.getBanner(userId);
    if (!banner) {
      res.status(204).end();
      return;
    }
    res
      .setHeader('Content-Type', banner.mime)
      .setHeader('Cache-Control', 'private, max-age=86400')
      .send(banner.blob);
  }

  @Post('user/banner')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: BANNER_MAX_BYTES } }),
  )
  setBanner(
    @CurrentUser() userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.users.setBanner(userId, file);
  }

  @Delete('user/banner')
  deleteBanner(@CurrentUser() userId: string) {
    return this.users.deleteBanner(userId);
  }

  @Post('user/password')
  @HttpCode(200)
  changePassword(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(changePasswordSchema))
    body: { currentPassword: string; newPassword: string },
  ) {
    return this.users.changePassword(
      userId,
      body.currentPassword,
      body.newPassword,
    );
  }

  @Get('profile/activity')
  activity(@CurrentUser() userId: string) {
    return this.users.activity(userId);
  }
}
