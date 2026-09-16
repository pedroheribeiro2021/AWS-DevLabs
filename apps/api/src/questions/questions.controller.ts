import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import type { RequestUser } from '../auth/types/jwt-payload.js';
import { FindQuestionsDto } from './dto/find-questions.dto.js';
import { SubmitAnswerDto } from './dto/submit-answer.dto.js';
import { QuestionsService } from './questions.service.js';

@ApiTags('questions')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard)
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get()
  findAll(@Query() filters: FindQuestionsDto, @CurrentUser() user: RequestUser) {
    return this.questionsService.findAll(user.id, filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.questionsService.findOne(id, user.id);
  }

  @Post(':id/answer')
  submitAnswer(
    @Param('id') id: string,
    @Body() dto: SubmitAnswerDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.questionsService.submitAnswer(id, user.id, dto.selectedOptionIds);
  }
}
