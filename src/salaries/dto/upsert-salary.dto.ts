import { IsIn, IsInt, IsMongoId, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { SALARY_TYPES, SalaryType } from '../schemas/salary.schema';

export class UpsertSalaryDto {
  /** Present when editing an existing record. */
  @IsOptional()
  @IsMongoId()
  id?: string;

  @IsIn(SALARY_TYPES)
  type: SalaryType; // 'salary' (coach) ou 'expense' (loyer, extras…)

  @IsString()
  name: string; // Nom du coach ou libellé (ex: 'Yassine', 'Loyer', 'Extras')

  @IsNumber()
  @Min(0)
  amount: number; // Montant en DT

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;
}
