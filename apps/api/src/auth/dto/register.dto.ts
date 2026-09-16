import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'estudante@example.com' })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email!: string;

  @ApiProperty({ example: 'pelo-menos-8-caracteres' })
  @IsString()
  @MinLength(8, { message: 'A senha precisa ter no mínimo 8 caracteres.' })
  password!: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  @IsString()
  @MinLength(2, { message: 'O nome precisa ter no mínimo 2 caracteres.' })
  name!: string;
}
