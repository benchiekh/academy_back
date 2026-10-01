/**
 * Seeds the database.
 *   npm run seed        → admin only (from .env ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD)
 *   npm run seed:demo   → WIPES the academy collections, then admin + full test dataset
 *                         (3 coaches, 7 parents, 14 players, ~5 months of attendance & payments)
 *
 * Test logins are listed in README.md (section "Comptes de test") and printed at the end.
 */
import * as dns from 'dns';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ActivityLog } from './activity/schemas/activity-log.schema';
import { AppModule } from './app.module';
import { Attendance, AttendanceStatus } from './attendance/schemas/attendance.schema';
import { Role } from './common/enums/role.enum';
import { Payment } from './payments/schemas/payment.schema';
import { Player } from './players/schemas/player.schema';
import { TechnicalSheet } from './players/schemas/technical-sheet.schema';
import { COACHES, DemoPlayer, PARENTS, PLAYERS, TEST_PASSWORDS } from './seed/demo-data';
import { User } from './users/schemas/user.schema';
import { UsersService } from './users/users.service';

dns.setServers(['8.8.8.8', '8.8.4.4']);

type App = Awaited<ReturnType<typeof NestFactory.createApplicationContext>>;

/** Training days per category (0 = Sunday … 6 = Saturday). */
const TRAINING_DAYS: Record<string, number[]> = {
  U9: [3, 6],
  U11: [2, 4, 6],
  U13: [1, 3, 6],
  U15: [1, 3, 5],
  U17: [1, 2, 4, 5],
  U19: [1, 2, 4, 5],
  Seniors: [2, 4, 5],
};
const HISTORY_MONTHS = 5; // current month + 4 previous


const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const SHEET_LABELS: Record<string, string> = {
  height: 'taille',
  weight: 'poids',
  strongHand: 'main forte',
  mainPosition: 'poste principal',
  secondaryPosition: 'poste secondaire',
  jerseyNumber: 'maillot',
  notes: 'remarques',
};

/** Small deterministic PRNG so every run produces the same dataset. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

async function seed() {
  const args = process.argv.slice(2);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const models = {
    user: app.get<Model<User>>(getModelToken(User.name)),
    player: app.get<Model<Player>>(getModelToken(Player.name)),
    sheet: app.get<Model<TechnicalSheet>>(getModelToken(TechnicalSheet.name)),
    attendance: app.get<Model<Attendance>>(getModelToken(Attendance.name)),
    payment: app.get<Model<Payment>>(getModelToken(Payment.name)),
    activity: app.get<Model<ActivityLog>>(getModelToken(ActivityLog.name)),
  };
  const usersService = app.get(UsersService);

  if (args.includes('--reset')) {
    await Promise.all(Object.values(models).map((m) => (m as Model<unknown>).deleteMany({})));
    console.log('Base vidée (users, players, sheets, attendance, payments, traçabilité).');
  }

  const adminEmail = (process.env.ADMIN_EMAIL ?? 'admin@academy.local').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'Admin123!';
  let admin = await models.user.findOne({ email: adminEmail });
  if (!admin) {
    admin = await models.user.create({
      name: process.env.ADMIN_NAME ?? 'Admin Académie',
      email: adminEmail,
      password: await usersService.hashPassword(adminPassword),
      role: Role.Admin,
      phone: '71000000',
    });
    console.log(`Admin créé: ${adminEmail}`);
  } else {
    console.log(`Admin ${adminEmail} existe déjà.`);
  }

  if (args.includes('--demo')) {
    await seedDemo(app, models, usersService, admin._id);
    printAccounts(adminEmail, adminPassword);
  }
  await app.close();
}

async function seedDemo(
  _app: App,
  models: {
    user: Model<User>;
    player: Model<Player>;
    sheet: Model<TechnicalSheet>;
    attendance: Model<Attendance>;
    payment: Model<Payment>;
    activity: Model<ActivityLog>;
  },
  usersService: UsersService,
  adminId: Types.ObjectId,
) {
  if (await models.user.exists({ email: COACHES[0].email })) {
    console.log('Données de démo déjà présentes — utilisez `npm run seed:demo` pour tout réinitialiser.');
    return;
  }

  const random = rng(42);
  const [coachHash, parentHash] = await Promise.all([
    usersService.hashPassword(TEST_PASSWORDS.coach),
    usersService.hashPassword(TEST_PASSWORDS.parent),
  ]);

  // Users
  const coachIds: Record<string, Types.ObjectId> = {};
  for (const c of COACHES) {
    const doc = await models.user.create({ name: c.name, email: c.email, phone: c.phone, password: coachHash, role: Role.Coach, createdBy: adminId });
    coachIds[c.key] = doc._id;
  }
  const parentIds: Record<string, Types.ObjectId> = {};
  for (const p of PARENTS) {
    const doc = await models.user.create({ name: p.name, email: p.email, phone: p.phone, password: parentHash, role: Role.Parent, createdBy: coachIds[p.createdBy] });
    parentIds[p.key] = doc._id;
  }

  // Players + technical sheets
  const players = await models.player.insertMany(
    PLAYERS.map((p) => ({
      name: p.name,
      dateOfBirth: new Date(p.dateOfBirth),
      parentId: parentIds[p.parent],
      category: p.category,
      monthlyFee: p.monthlyFee,
      active: p.active ?? true,
    })),
  );
  // Any coach may mark attendance/payments now; spread the work across them for realism.
  const coachList = Object.values(coachIds);
  const withDemo = players.map((doc, i) => ({ doc, demo: PLAYERS[i], coachId: coachList[i % coachList.length] }));

  await models.sheet.insertMany(
    withDemo
      .filter(({ demo }) => demo.sheet)
      .map(({ doc, demo, coachId }) => ({ playerId: doc._id, ...demo.sheet, updatedBy: coachId })),
  );

  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const firstDay = Date.UTC(today.getFullYear(), today.getMonth() - (HISTORY_MONTHS - 1), 1);
  const joinedRecently = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() - 21);
  const coachName = new Map(COACHES.map((c) => [coachIds[c.key].toString(), c.name]));
  const adminName = (await models.user.findById(adminId).select('name').lean())?.name ?? 'Admin';
  const logs: Record<string, unknown>[] = [];
  /** Seeded times on the current day must never be in the future. */
  const notFuture = (d: Date) => (d.getTime() > Date.now() ? new Date(Date.now() - 5 * 60_000) : d);
  const log = (actorId: Types.ObjectId, actorRole: Role, at: Date, entry: Record<string, unknown>) =>
    logs.push({
      actorId,
      actorName: actorRole === Role.Admin ? adminName : coachName.get(actorId.toString()),
      actorRole,
      createdAt: notFuture(at),
      ...entry,
    });

  // Account & player creation history, at the start of the period
  const startAt = (offsetDays: number, hour: number) => new Date(firstDay - 20 * 86_400_000 + offsetDays * 86_400_000 + hour * 3_600_000);
  COACHES.forEach((c, i) =>
    log(adminId, Role.Admin, startAt(i, 9), {
      action: 'user.create',
      targetUserName: c.name,
      summary: `a créé le compte coach de ${c.name} (${c.email})`,
      meta: { role: 'coach', email: c.email },
    }),
  );
  PARENTS.forEach((p, i) =>
    log(coachIds[p.createdBy], Role.Coach, startAt(4 + i, 17), {
      action: 'user.create',
      targetUserName: p.name,
      summary: `a créé le compte parent de ${p.name} (${p.email})`,
      meta: { role: 'parent', email: p.email },
    }),
  );
  withDemo.forEach(({ doc, demo, coachId }, i) =>
    log(coachId, Role.Coach, demo.payer === 'new' ? new Date(joinedRecently + 18 * 3_600_000) : startAt(6 + (i % 10), 18), {
      action: 'player.create',
      playerId: doc._id,
      playerName: demo.name,
      summary: `a inscrit ${demo.name} (${demo.category})`,
      meta: { category: demo.category, monthlyFee: demo.monthlyFee },
    }),
  );
  withDemo
    .filter(({ demo }) => demo.sheet)
    .forEach(({ doc, demo, coachId }) =>
      log(coachId, Role.Coach, new Date(todayUtc - Math.floor(random() * 25 + 1) * 86_400_000 + 20 * 3_600_000), {
        action: 'sheet.update',
        playerId: doc._id,
        playerName: demo.name,
        summary: `a mis à jour la fiche technique de ${demo.name} (${Object.keys(demo.sheet!).map((k) => SHEET_LABELS[k] ?? k).join(', ')})`,
        meta: { fields: Object.keys(demo.sheet!) },
      }),
    );

  // Attendance: no groups — every coach coaches every child. Each training day one coach (whoever is on duty) takes the roll call.
  const attendance: Record<string, unknown>[] = [];
  for (let t = firstDay; t <= todayUtc; t += 86_400_000) {
    const date = new Date(t);
    const sessions = new Map<string, { coachId: Types.ObjectId; rows: { status: AttendanceStatus; category: string }[] }>();
    for (const { doc, demo } of withDemo) {
      if (!TRAINING_DAYS[demo.category].includes(date.getUTCDay())) continue;
      if (demo.payer === 'new' && t < joinedRecently) continue;
      if (demo.active === false && t > todayUtc - 45 * 86_400_000) continue; // inactive: stopped ~6 weeks ago

      if (!sessions.has('day')) {
        const onDuty = COACHES[Math.floor(random() * COACHES.length)].key;
        sessions.set('day', { coachId: coachIds[onDuty], rows: [] });
      }
      const session = sessions.get('day')!;
      const status = pickStatus(random(), demo.attendance);
      session.rows.push({ status, category: demo.category });
      const at = notFuture(new Date(t + (18 * 60 + 45 + Math.floor(random() * 40)) * 60_000));
      attendance.push({ playerId: doc._id, date, status, markedBy: session.coachId, createdAt: at, updatedAt: at });
    }
    for (const { coachId, rows } of sessions.values()) {
      const counts = { present: 0, absent: 0, excused: 0 };
      rows.forEach((r) => counts[r.status]++);
      const categories = [...new Set(rows.map((r) => r.category))].sort();
      const day = date.toLocaleDateString('fr-FR', { timeZone: 'UTC' });
      log(coachId, Role.Coach, new Date(t + (19 * 60 + 5) * 60_000), {
        action: 'attendance.mark',
        summary: `a fait l'appel du ${day} (${categories.join(', ')}) — ${plural(counts.present, 'présent')}, ${plural(counts.absent, 'absent')}, ${plural(counts.excused, 'justifié')}`,
        meta: { date, counts, categories, players: rows.length },
      });
    }
  }
  await models.attendance.insertMany(attendance, { timestamps: false } as never);

  // Payments
  const payments: Record<string, unknown>[] = [];
  for (let back = HISTORY_MONTHS - 1; back >= 0; back--) {
    const ref = new Date(today.getFullYear(), today.getMonth() - back, 1);
    const month = ref.getMonth() + 1;
    const year = ref.getFullYear();
    for (const { doc, demo, coachId } of withDemo) {
      if (demo.payer === 'new' && back > 0) continue;
      const paid = isPaid(demo, back);
      const day = Math.min(2 + Math.floor(random() * 9), back === 0 ? today.getDate() : 28);
      const at = notFuture(new Date(year, month - 1, day, 18, 30 + Math.floor(random() * 25)));
      payments.push({
        playerId: doc._id,
        month,
        year,
        status: paid ? 'paid' : 'unpaid',
        amount: demo.monthlyFee,
        paymentDate: paid ? at : undefined,
        markedBy: coachId,
        createdAt: at,
        updatedAt: at,
      });
      const period = `${MONTHS_FR[month - 1]} ${year}`;
      if (paid) {
        log(coachId, Role.Coach, at, {
          action: 'payment.paid',
          playerId: doc._id,
          playerName: demo.name,
          summary: `a marqué ${demo.name} khalès pour ${period} (${demo.monthlyFee} DT)`,
          meta: { month, year, amount: demo.monthlyFee, previousStatus: null },
        });
      } else if (demo.payer === 'late' && back === 0) {
        // Realistic correction: marked paid by mistake, then switched back a few minutes later.
        const oops = new Date(at.getTime() - 10 * 60_000);
        log(coachId, Role.Coach, oops, {
          action: 'payment.paid',
          playerId: doc._id,
          playerName: demo.name,
          summary: `a marqué ${demo.name} khalès pour ${period} (${demo.monthlyFee} DT)`,
          meta: { month, year, amount: demo.monthlyFee, previousStatus: null },
        });
        log(coachId, Role.Coach, at, {
          action: 'payment.unpaid',
          playerId: doc._id,
          playerName: demo.name,
          summary: `a repassé ${demo.name} en non khalès pour ${period}`,
          meta: { month, year, amount: demo.monthlyFee, previousStatus: 'paid' },
        });
      }
    }
  }
  await models.payment.insertMany(payments, { timestamps: false } as never);
  await models.activity.insertMany(
    logs,
    { timestamps: false } as never,
  );

  console.log(
    `Démo: ${COACHES.length} coachs, ${PARENTS.length} parents, ${players.length} joueurs, ` +
      `${attendance.length} présences, ${payments.length} paiements, ${logs.length} entrées de traçabilité.`,
  );
}

function plural(n: number, word: string) {
  return `${n} ${word}${n > 1 ? 's' : ''}`;
}

function pickStatus(r: number, rate: number): AttendanceStatus {
  if (r < rate) return 'present';
  return r < rate + (1 - rate) * 0.6 ? 'absent' : 'excused';
}

/** `back` = months before the current one (0 = current). */
function isPaid(p: DemoPlayer, back: number) {
  switch (p.payer) {
    case 'good':
    case 'new':
      return true;
    case 'late':
      return back > 0;
    case 'debt':
      return back > 2;
  }
}

function printAccounts(adminEmail: string, adminPassword: string) {
  const rows = [
    ['admin', adminEmail, adminPassword, 'accès complet'],
    ...COACHES.map((c) => ['coach', c.email, TEST_PASSWORDS.coach, c.name]),
    ...PARENTS.map((p) => ['parent', p.email, TEST_PASSWORDS.parent, p.note]),
  ];
  console.log('\nComptes de test (local uniquement) :');
  console.table(rows.map(([role, email, password, info]) => ({ role, email, password, info })));
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
