import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type SalaryDocument = HydratedDocument<Salary>;

export const SALARY_TYPES = ['salary', 'expense'] as const;
export type SalaryType = (typeof SALARY_TYPES)[number];

@Schema({ timestamps: true, versionKey: false })
export class Salary {
  @Prop({ type: String, enum: SALARY_TYPES, required: true })
  type: SalaryType; // 'salary' (coach) ou 'expense' (loyer, etc.)

  @Prop({ required: true, trim: true })
  name: string; // Nom du coach ou libellé (ex: 'Yassine', 'Loyer')

  @Prop({ type: Number, min: 0, required: true })
  amount: number; // Montant en DT

  @Prop({ required: true, min: 1, max: 12 })
  month: number;

  @Prop({ required: true, min: 2000, max: 2100 })
  year: number;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  markedBy?: Types.ObjectId;
}

export const SalarySchema = SchemaFactory.createForClass(Salary);
SalarySchema.index({ name: 1, month: 1, year: 1 }, { unique: true });