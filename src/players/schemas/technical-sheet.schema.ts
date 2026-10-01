import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export const POSITIONS = [
  'goalkeeper',
  'left_wing',
  'right_wing',
  'left_back',
  'right_back',
  'center_back',
  'pivot',
] as const;
export type Position = (typeof POSITIONS)[number];

export const STRONG_HANDS = ['right', 'left'] as const;
export type StrongHand = (typeof STRONG_HANDS)[number];

export type TechnicalSheetDocument = HydratedDocument<TechnicalSheet>;

/** Fiche technique — one per player, edited by the coach. Age & category live on Player. */
@Schema({ timestamps: true, versionKey: false })
export class TechnicalSheet {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Player', required: true, unique: true })
  playerId: Types.ObjectId;

  /** Height in cm. */
  @Prop({ type: Number, min: 50, max: 250 })
  height?: number;

  /** Weight in kg. */
  @Prop({ type: Number, min: 10, max: 200 })
  weight?: number;

  @Prop({ type: String, enum: STRONG_HANDS })
  strongHand?: StrongHand;

  @Prop({ type: String, enum: POSITIONS })
  mainPosition?: Position;

  @Prop({ type: String, enum: POSITIONS })
  secondaryPosition?: Position;

  @Prop({ type: Number, min: 1, max: 99 })
  jerseyNumber?: number;

  @Prop({ trim: true, maxlength: 2000 })
  notes?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;
}

export const TechnicalSheetSchema = SchemaFactory.createForClass(TechnicalSheet);
