import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export const ATTENDANCE_STATUSES = ['present', 'absent', 'excused'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export type AttendanceDocument = HydratedDocument<Attendance>;

@Schema({ timestamps: true, versionKey: false })
export class Attendance {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Player', required: true })
  playerId: Types.ObjectId;

  /** Always stored as midnight UTC (see toUtcDay). */
  @Prop({ required: true })
  date: Date;

  @Prop({ type: String, enum: ATTENDANCE_STATUSES, required: true })
  status: AttendanceStatus;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  markedBy?: Types.ObjectId;
}

export const AttendanceSchema = SchemaFactory.createForClass(Attendance);
AttendanceSchema.index({ playerId: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ date: 1 });
