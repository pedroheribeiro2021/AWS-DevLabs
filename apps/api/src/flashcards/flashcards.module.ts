import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FlashcardsController } from './flashcards.controller.js';
import { FlashcardsService } from './flashcards.service.js';

@Module({
  imports: [AuthModule],
  controllers: [FlashcardsController],
  providers: [FlashcardsService],
})
export class FlashcardsModule {}
