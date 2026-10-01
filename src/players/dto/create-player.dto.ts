import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CATEGORIES, Category } from '../schemas/player.schema';

export class CreatePlayerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsDateString()
  dateOfBirth: string;

  @IsMongoId()
  parentId: string;

  @IsIn(CATEGORIES)
  category: Category;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyFee?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
