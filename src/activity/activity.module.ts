import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { ActivityLog, ActivityLogSchema } from './schemas/activity-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ActivityLog.name, schema: ActivityLogSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ActivityController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
