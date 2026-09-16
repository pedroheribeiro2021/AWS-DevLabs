import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class SubmitAnswerDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty({ message: 'Selecione ao menos uma alternativa.' })
  @IsString({ each: true })
  selectedOptionIds!: string[];
}
