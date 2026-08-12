import { Module } from '@nestjs/common';
import { FriendsModule } from '../friends/friends.module';
import { ChatUploadService } from './chat-upload.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [FriendsModule],
  controllers: [ChatController],
  providers: [ChatService, ChatUploadService],
})
export class ChatModule {}
