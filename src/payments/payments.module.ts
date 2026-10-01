import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityModule } from '../activity/activity.module';
import { PlayersModule } from '../players/players.module';
import { Player, PlayerSchema } from '../players/schemas/player.schema';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment, PaymentSchema } from './schemas/payment.schema';

@Module({
  imports: [
    PlayersModule,
    ActivityModule,
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Player.name, schema: PlayerSchema },
    ]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
