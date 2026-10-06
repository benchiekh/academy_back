import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { minutes, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ActivityModule } from './activity/activity.module';
import { AttendanceModule } from './attendance/attendance.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PaymentsModule } from './payments/payments.module';
import { PlayersModule } from './players/players.module';
import { ScheduleModule } from './schedule/schedule.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI', 'mongodb://localhost:27017/handball_academy'),
        // Node 17+ resolves "localhost" to ::1 first; mongod usually listens on 127.0.0.1 only.
        family: 4,
      }),
    }),
    // Global rate limit: 100 requests/minute per IP (login is stricter, see AuthController).
    ThrottlerModule.forRoot([{ ttl: minutes(1), limit: 100 }]),
    AuthModule,
    UsersModule,
    PlayersModule,
    AttendanceModule,
    PaymentsModule,
    ActivityModule,
    ScheduleModule,
  ],
  providers: [
    // Order matters: throttle first (cheap rejection), then authenticate, then check roles.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
