import { IsString, MaxLength } from 'class-validator';

export class UpdateScheduleDto {
  @IsString()
  @MaxLength(4000)
  content: string;
}
