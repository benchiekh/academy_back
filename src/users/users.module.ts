import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityModule } from '../activity/activity.module';
import { Player, PlayerSchema } from '../players/schemas/player.schema';
import { User, UserSchema } from './schemas/user.schema';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    ActivityModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Player.name, schema: PlayerSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
