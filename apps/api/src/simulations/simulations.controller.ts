import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import type { RequestUser } from '../auth/types/jwt-payload.js';
import { StartSimulationDto } from './dto/start-simulation.dto.js';
import { UpdateSimulationQuestionDto } from './dto/update-simulation-question.dto.js';
import { SimulationsService } from './simulations.service.js';

@ApiTags('simulations')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard)
@Controller('simulations')
export class SimulationsController {
  constructor(private readonly simulationsService: SimulationsService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.simulationsService.findAll(user.id);
  }

  @Post('start')
  start(@Body() dto: StartSimulationDto, @CurrentUser() user: RequestUser) {
    return this.simulationsService.start(
      user.id,
      dto.examVersionId,
      dto.questionCount,
      dto.durationMinutes,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.simulationsService.findOne(id, user.id);
  }

  @Patch(':id/questions/:questionId')
  updateQuestion(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body() dto: UpdateSimulationQuestionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.simulationsService.updateQuestion(
      id,
      questionId,
      user.id,
      dto.selectedOptionIds,
      dto.flagged,
    );
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.simulationsService.submit(id, user.id);
  }

  @Get(':id/review')
  review(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.simulationsService.review(id, user.id);
  }
}
