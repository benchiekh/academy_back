import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum';

export const ACTIVITY_ACTIONS = [
  'attendance.mark',
  'payment.paid',
  'payment.unpaid',
  'sheet.update',
  'player.create',
  'player.update',
  'player.delete',
  'user.create',
  'user.update',
  'user.delete',
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export type ActivityLogDocument = HydratedDocument<ActivityLog>;

/** Append-only journal of staff actions (traçabilité). Names are copied so entries stay readable after deletions. */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, versionKey: false })
export class ActivityLog {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  actorId: Types.ObjectId;

  @Prop({ required: true })
  actorName: string;

  @Prop({ type: String, enum: Object.values(Role), required: true })
  actorRole: Role;

  @Prop({ type: String, enum: ACTIVITY_ACTIONS, required: true })
  action: ActivityAction;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Player' })
  playerId?: Types.ObjectId;

  @Prop()
  playerName?: string;

  @Prop()
  targetUserName?: string;

  /** Human-readable French sentence, without the actor name (e.g. "a fait l'appel du 28/09 — 10 présents"). */
  @Prop({ required: true })
  summary: string;

  @Prop({ type: SchemaTypes.Mixed })
  meta?: Record<string, unknown>;

  createdAt?: Date;
}

export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog);
ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ actorId: 1, createdAt: -1 });
ActivityLogSchema.index({ action: 1, createdAt: -1 });
ActivityLogSchema.index({ playerId: 1, createdAt: -1 });
