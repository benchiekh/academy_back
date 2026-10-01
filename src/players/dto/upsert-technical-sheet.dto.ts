import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { POSITIONS, Position, STRONG_HANDS, StrongHand } from '../schemas/technical-sheet.schema';

export class UpsertTechnicalSheetDto {
  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(250)
  height?: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(200)
  weight?: number;

  @IsOptional()
  @IsIn(STRONG_HANDS)
  strongHand?: StrongHand;

  @IsOptional()
  @IsIn(POSITIONS)
  mainPosition?: Position;

  @IsOptional()
  @IsIn(POSITIONS)
  secondaryPosition?: Position;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  jerseyNumber?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
