import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { GamificationModule } from '../gamification/gamification.module.js';
import { LabsController } from './labs.controller.js';
import { LabsService } from './labs.service.js';

@Module({
  imports: [AuthModule, GamificationModule],
  controllers: [LabsController],
  providers: [LabsService],
})
export class LabsModule {}
