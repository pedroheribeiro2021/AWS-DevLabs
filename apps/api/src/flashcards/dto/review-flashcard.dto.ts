import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ReviewFlashcardDto {
  @ApiProperty()
  @IsBoolean()
  correct!: boolean;
}
