import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/** Singleton document: the weekly training program shown on the login page and in the parent space. */
@Schema({ timestamps: true })
export class Schedule {
  @Prop({ default: '' })
  content: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;
}

export const ScheduleSchema = SchemaFactory.createForClass(Schedule);
