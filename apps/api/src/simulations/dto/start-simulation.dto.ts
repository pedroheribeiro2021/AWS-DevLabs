import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class StartSimulationDto {
  @ApiProperty()
  @IsString()
  examVersionId!: string;

  @ApiPropertyOptional({
    description: 'Defaults to the exam version questionCount when omitted.',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  questionCount?: number;

  @ApiPropertyOptional({
    description: 'Defaults to the exam version durationMinutes when omitted.',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  durationMinutes?: number;
}
