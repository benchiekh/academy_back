import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityModule } from '../activity/activity.module';
import { PlayersModule } from '../players/players.module';
import { Player, PlayerSchema } from '../players/schemas/player.schema';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { Attendance, AttendanceSchema } from './schemas/attendance.schema';

@Module({
  imports: [
    PlayersModule,
    ActivityModule,
    MongooseModule.forFeature([
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Player.name, schema: PlayerSchema },
    ]),
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
})
export class AttendanceModule {}
