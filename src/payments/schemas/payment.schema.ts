import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export const PAYMENT_STATUSES = ['paid', 'unpaid'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type PaymentDocument = HydratedDocument<Payment>;

@Schema({ timestamps: true, versionKey: false })
export class Payment {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Player', required: true })
  playerId: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 12 })
  month: number;

  @Prop({ required: true, min: 2000, max: 2100 })
  year: number;

  @Prop({ type: String, enum: PAYMENT_STATUSES, required: true, default: 'unpaid' })
  status: PaymentStatus;

  @Prop({ type: Number, min: 0, default: 0 })
  amount: number;

  @Prop()
  paymentDate?: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  markedBy?: Types.ObjectId;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.index({ playerId: 1, year: 1, month: 1 }, { unique: true });
PaymentSchema.index({ year: 1, month: 1, status: 1 });
