import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityModule } from '../activity/activity.module';
import { Attendance, AttendanceSchema } from '../attendance/schemas/attendance.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';
import { Player, PlayerSchema } from './schemas/player.schema';
import { TechnicalSheet, TechnicalSheetSchema } from './schemas/technical-sheet.schema';

@Module({
  imports: [
    ActivityModule,
    MongooseModule.forFeature([
      { name: Player.name, schema: PlayerSchema },
      { name: TechnicalSheet.name, schema: TechnicalSheetSchema },
      { name: User.name, schema: UserSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
  ],
  controllers: [PlayersController],
  providers: [PlayersService],
  exports: [PlayersService],
})
export class PlayersModule {}
