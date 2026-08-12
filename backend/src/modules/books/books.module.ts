import { Module } from '@nestjs/common';
import { FriendsModule } from '../friends/friends.module';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';

@Module({
  imports: [FriendsModule],
  controllers: [BooksController],
  providers: [BooksService],
})
export class BooksModule {}
