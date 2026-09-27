import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import type { RequestUser } from '../auth/types/jwt-payload.js';
import { AnalyticsService } from './analytics.service.js';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('me')
  getMine(@CurrentUser() user: RequestUser) {
    return this.analyticsService.getForUser(user.id);
  }
}
