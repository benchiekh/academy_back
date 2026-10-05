import * as dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { User, UserDocument } from './users/schemas/user.schema';
import { Player, PlayerDocument } from './players/schemas/player.schema';
import {
  TechnicalSheet,
  TechnicalSheetDocument,
} from './players/schemas/technical-sheet.schema';
import { Attendance, AttendanceDocument } from './attendance/schemas/attendance.schema';
import { Payment, PaymentDocument } from './payments/schemas/payment.schema';
import {
  ActivityLog,
  ActivityLogDocument,
} from './activity/schemas/activity-log.schema';
import { Role } from './common/enums/role.enum';

async function cleanup() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
  const playerModel = app.get<Model<PlayerDocument>>(
    getModelToken(Player.name),
  );
  const technicalSheetModel = app.get<Model<TechnicalSheetDocument>>(
    getModelToken(TechnicalSheet.name),
  );
  const attendanceModel = app.get<Model<AttendanceDocument>>(
    getModelToken(Attendance.name),
  );
  const paymentModel = app.get<Model<PaymentDocument>>(
    getModelToken(Payment.name),
  );
  const activityLogModel = app.get<Model<ActivityLogDocument>>(
    getModelToken(ActivityLog.name),
  );

  console.log('=== NETTOYAGE DE LA BASE ===');

  const usersBefore = await userModel.countDocuments();

  const adminsAndCoaches = await userModel.countDocuments({
    role: { $in: [Role.Admin, Role.Coach] },
  });

  const parents = await userModel.countDocuments({
    role: Role.Parent,
  });

  console.log(`Utilisateurs avant : ${usersBefore}`);
  console.log(`Admin + coachs conservés : ${adminsAndCoaches}`);
  console.log(`Parents supprimables : ${parents}`);

  const deletedUsers = await userModel.deleteMany({
    role: Role.Parent,
  });

  const deletedPlayers = await playerModel.deleteMany({});
  const deletedTechnicalSheets = await technicalSheetModel.deleteMany({});
  const deletedAttendance = await attendanceModel.deleteMany({});
  const deletedPayments = await paymentModel.deleteMany({});
  const deletedActivityLogs = await activityLogModel.deleteMany({});

  console.log('');
  console.log('=== RÉSULTAT ===');
  console.log(`Utilisateurs supprimés : ${deletedUsers.deletedCount}`);
  console.log(`Joueurs supprimés : ${deletedPlayers.deletedCount}`);
  console.log(
    `Fiches techniques supprimées : ${deletedTechnicalSheets.deletedCount}`,
  );
  console.log(`Présences supprimées : ${deletedAttendance.deletedCount}`);
  console.log(`Paiements supprimés : ${deletedPayments.deletedCount}`);
  console.log(`Logs supprimés : ${deletedActivityLogs.deletedCount}`);

  const remainingUsers = await userModel.find(
    {},
    { name: 1, email: 1, role: 1 },
  );

  console.log('');
  console.log('=== UTILISATEURS RESTANTS ===');

  for (const user of remainingUsers) {
    console.log(`${user.role} - ${user.email}`);
  }

  await app.close();
}

cleanup().catch((error) => {
  console.error('Erreur pendant le nettoyage :', error);
  process.exit(1);
});