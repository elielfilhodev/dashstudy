import { Module } from '@nestjs/common';
import { GifsController } from './gifs.controller';
import { GifsService } from './gifs.service';
import { PresenceController } from './presence.controller';

@Module({
  controllers: [PresenceController, GifsController],
  providers: [GifsService],
})
export class MiscModule {}
