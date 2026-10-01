import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CATEGORIES, Category } from '../schemas/player.schema';

export class UpdatePlayerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsMongoId()
  parentId?: string;

  @IsOptional()
  @IsIn(CATEGORIES)
  category?: Category;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyFee?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
