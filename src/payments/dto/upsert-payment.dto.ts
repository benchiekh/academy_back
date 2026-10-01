import {
  IsDateString,
  IsIn,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { PAYMENT_STATUSES, PaymentStatus } from '../schemas/payment.schema';

export class UpsertPaymentDto {
  @IsMongoId()
  playerId: string;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @IsIn(PAYMENT_STATUSES)
  status: PaymentStatus;

  /** Defaults to the player's monthlyFee. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  /** Defaults to now when status is 'paid'; cleared when 'unpaid'. */
  @IsOptional()
  @IsDateString()
  paymentDate?: string;
}
