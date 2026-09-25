import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { GamificationModule } from '../gamification/gamification.module.js';
import { LearningController } from './learning.controller.js';
import { LearningService } from './learning.service.js';

@Module({
  imports: [AuthModule, GamificationModule],
  controllers: [LearningController],
  providers: [LearningService],
})
export class LearningModule {}
