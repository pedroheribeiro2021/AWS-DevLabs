import { ApiPropertyOptional } from '@nestjs/swagger';
import { QuestionDifficulty, QuestionType } from '@aws-devlab/database';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class FindQuestionsDto {
  @ApiPropertyOptional({ enum: QuestionDifficulty })
  @IsOptional()
  @IsEnum(QuestionDifficulty)
  difficulty?: QuestionDifficulty;

  @ApiPropertyOptional({ enum: QuestionType })
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  topicId?: string;
}
