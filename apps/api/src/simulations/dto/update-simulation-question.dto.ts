import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateSimulationQuestionDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedOptionIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  flagged?: boolean;
}
