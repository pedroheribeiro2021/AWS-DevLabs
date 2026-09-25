import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { GamificationModule } from '../gamification/gamification.module.js';
import { SimulationsController } from './simulations.controller.js';
import { SimulationsService } from './simulations.service.js';

@Module({
  imports: [AuthModule, GamificationModule],
  controllers: [SimulationsController],
  providers: [SimulationsService],
})
export class SimulationsModule {}
