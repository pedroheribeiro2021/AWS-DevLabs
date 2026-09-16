import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { QuestionsController } from './questions.controller.js';
import { QuestionsService } from './questions.service.js';

@Module({
  imports: [AuthModule],
  controllers: [QuestionsController],
  providers: [QuestionsService],
})
export class QuestionsModule {}
