import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import type { RequestUser } from '../auth/types/jwt-payload.js';
import { ReviewFlashcardDto } from './dto/review-flashcard.dto.js';
import { FlashcardsService } from './flashcards.service.js';

@ApiTags('flashcards')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard)
@Controller('flashcards')
export class FlashcardsController {
  constructor(private readonly flashcardsService: FlashcardsService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.flashcardsService.findAll(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.flashcardsService.findOne(id, user.id);
  }

  @Post(':id/review')
  review(
    @Param('id') id: string,
    @Body() dto: ReviewFlashcardDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.flashcardsService.review(id, user.id, dto.correct);
  }
}
