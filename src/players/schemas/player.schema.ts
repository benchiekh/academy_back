import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export const CATEGORIES = ['U9', 'U11', 'U13', 'U15', 'U17', 'U19', 'Seniors'] as const;
export type Category = (typeof CATEGORIES)[number];

export type PlayerDocument = HydratedDocument<Player>;

@Schema({ timestamps: true, versionKey: false })
export class Player {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true })
  dateOfBirth: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true, index: true })
  parentId: Types.ObjectId;

  @Prop({ type: String, enum: CATEGORIES, required: true, index: true })
  category: Category;

  /** Monthly fee in local currency; used as the default amount when marking payments. */
  @Prop({ type: Number, min: 0, default: 0 })
  monthlyFee: number;

  @Prop({ default: true })
  active: boolean;
}

export const PlayerSchema = SchemaFactory.createForClass(Player);
