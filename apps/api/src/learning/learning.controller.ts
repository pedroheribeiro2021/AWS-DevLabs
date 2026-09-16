import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import type { RequestUser } from '../auth/types/jwt-payload.js';
import { LearningService } from './learning.service.js';

@ApiTags('learning')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard)
@Controller('learning')
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  @Get('track/:certificationSlug')
  getTrack(@Param('certificationSlug') certificationSlug: string, @CurrentUser() user: RequestUser) {
    return this.learningService.getTrack(certificationSlug, user.id);
  }

  @Get('lessons/:id')
  getLesson(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.learningService.getLesson(id, user.id);
  }

  @Post('lessons/:id/complete')
  completeLesson(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.learningService.completeLesson(id, user.id);
  }
}
