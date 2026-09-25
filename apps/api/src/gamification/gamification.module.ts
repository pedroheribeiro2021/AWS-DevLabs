import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BadgesService } from './badges.service.js';
import { GamificationController } from './gamification.controller.js';
import { GamificationService } from './gamification.service.js';

@Module({
  imports: [AuthModule],
  controllers: [GamificationController],
  providers: [GamificationService, BadgesService],
  exports: [GamificationService],
})
export class GamificationModule {}
