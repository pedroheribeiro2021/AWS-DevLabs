import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import type { RequestUser } from '../auth/types/jwt-payload.js';
import { GamificationService } from './gamification.service.js';

@ApiTags('gamification')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard)
@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('me')
  getMyStats(@CurrentUser() user: RequestUser) {
    return this.gamificationService.getStats(user.id);
  }
}
