import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum';

export type UserDocument = HydratedDocument<User>;

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_doc, ret: Record<string, unknown>) => {
      delete ret.password;
      delete ret.__v;
      return ret;
    },
  },
})
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  /** bcrypt hash — never returned by default queries. */
  @Prop({ required: true, select: false })
  password: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ type: String, enum: Object.values(Role), required: true, index: true })
  role: Role;

  /** Who created this account (coach that created a parent, admin that created a coach). */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;
}

export const UserSchema = SchemaFactory.createForClass(User);
