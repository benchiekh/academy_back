import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Schedule } from './schemas/schedule.schema';

@Injectable()
export class ScheduleService {
  constructor(@InjectModel(Schedule.name) private readonly scheduleModel: Model<Schedule>) {}

  /** The single schedule document, created empty on first read. */
  async get() {
    const doc = await this.scheduleModel.findOne().lean();
    if (doc) return doc;
    return this.scheduleModel.create({ content: '' });
  }

  update(content: string, user: AuthUser) {
    return this.scheduleModel
      .findOneAndUpdate(
        {},
        { $set: { content, updatedBy: new Types.ObjectId(user.userId) } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .lean();
  }
}
