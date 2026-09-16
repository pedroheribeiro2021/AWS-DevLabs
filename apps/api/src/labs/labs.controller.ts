import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import type { RequestUser } from '../auth/types/jwt-payload.js';
import { LabsService } from './labs.service.js';

@ApiTags('labs')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard)
@Controller('labs')
export class LabsController {
  constructor(private readonly labsService: LabsService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.labsService.findAll(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.labsService.findOne(id, user.id);
  }

  @Post(':id/start')
  start(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.labsService.start(id, user.id);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.labsService.complete(id, user.id);
  }
}
