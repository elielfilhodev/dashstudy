import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  addGroupMemberSchema,
  createGroupSchema,
  messagePageSchema,
  sendMessageSchema,
  updateGroupSchema,
  type CreateGroupInput,
  type SendMessageInput,
  type UpdateGroupInput,
} from '../../common/schemas';
import { ChatUploadService, UPLOAD_MAX_BYTES } from './chat-upload.service';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly uploads: ChatUploadService,
  ) {}

  @Get('conversations')
  conversations(@CurrentUser() userId: string) {
    return this.chat.conversations(userId);
  }

  @Post('upload')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: UPLOAD_MAX_BYTES } }),
  )
  upload(
    @CurrentUser() userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.uploads.upload(userId, file);
  }

  @Get('direct/:otherId')
  directMessages(
    @CurrentUser() userId: string,
    @Param('otherId') otherId: string,
    @Query(new ZodValidationPipe(messagePageSchema)) query: { cursor?: string },
  ) {
    return this.chat.directMessages(userId, otherId, query.cursor);
  }

  @Post('direct/:otherId')
  sendDirect(
    @CurrentUser() userId: string,
    @Param('otherId') otherId: string,
    @Body(new ZodValidationPipe(sendMessageSchema)) body: SendMessageInput,
  ) {
    return this.chat.sendDirect(userId, otherId, body);
  }

  @Get('groups')
  listGroups(@CurrentUser() userId: string) {
    return this.chat.listGroups(userId);
  }

  @Post('groups')
  createGroup(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(createGroupSchema)) body: CreateGroupInput,
  ) {
    return this.chat.createGroup(userId, body.name, body.description ?? null);
  }

  @Get('groups/:groupId')
  getGroup(@CurrentUser() userId: string, @Param('groupId') groupId: string) {
    return this.chat.getGroup(userId, groupId);
  }

  @Patch('groups/:groupId')
  updateGroup(
    @CurrentUser() userId: string,
    @Param('groupId') groupId: string,
    @Body(new ZodValidationPipe(updateGroupSchema)) body: UpdateGroupInput,
  ) {
    return this.chat.updateGroup(userId, groupId, body);
  }

  @Delete('groups/:groupId')
  @HttpCode(204)
  deleteGroup(
    @CurrentUser() userId: string,
    @Param('groupId') groupId: string,
  ) {
    return this.chat.deleteGroup(userId, groupId);
  }

  @Get('groups/:groupId/messages')
  groupMessages(
    @CurrentUser() userId: string,
    @Param('groupId') groupId: string,
    @Query(new ZodValidationPipe(messagePageSchema)) query: { cursor?: string },
  ) {
    return this.chat.groupMessages(userId, groupId, query.cursor);
  }

  @Post('groups/:groupId/messages')
  sendGroupMessage(
    @CurrentUser() userId: string,
    @Param('groupId') groupId: string,
    @Body(new ZodValidationPipe(sendMessageSchema)) body: SendMessageInput,
  ) {
    return this.chat.sendGroupMessage(userId, groupId, body);
  }

  @Get('groups/:groupId/members')
  listMembers(
    @CurrentUser() userId: string,
    @Param('groupId') groupId: string,
  ) {
    return this.chat.listMembers(userId, groupId);
  }

  @Post('groups/:groupId/members')
  addMember(
    @CurrentUser() userId: string,
    @Param('groupId') groupId: string,
    @Body(new ZodValidationPipe(addGroupMemberSchema)) body: { userId: string },
  ) {
    return this.chat.addMember(userId, groupId, body.userId);
  }

  @Delete('groups/:groupId/members/:targetId')
  @HttpCode(204)
  removeMember(
    @CurrentUser() userId: string,
    @Param('groupId') groupId: string,
    @Param('targetId') targetId: string,
  ) {
    return this.chat.removeMember(userId, groupId, targetId);
  }

  @Patch('groups/:groupId/members/:targetId')
  toggleCoAdmin(
    @CurrentUser() userId: string,
    @Param('groupId') groupId: string,
    @Param('targetId') targetId: string,
  ) {
    return this.chat.toggleCoAdmin(userId, groupId, targetId);
  }
}
