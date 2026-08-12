import { Module } from '@nestjs/common';
import { FriendProfileService } from './friend-profile.service';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';

@Module({
  controllers: [FriendsController],
  providers: [FriendsService, FriendProfileService],
  exports: [FriendsService],
})
export class FriendsModule {}
