import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { monthRange } from '../common/utils/date.util';
import { User } from '../users/schemas/user.schema';
import { ActivityAction, ActivityLog } from './schemas/activity-log.schema';

export interface ActivityEntry {
  action: ActivityAction;
  summary: string;
  playerId?: Types.ObjectId | string;
  playerName?: string;
  targetUserName?: string;
  meta?: Record<string, unknown>;
}

export interface ActivityFilters {
  actorId?: string;
  /** Exact action, or a prefix such as "payment" / "attendance". */
  action?: string;
  playerId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);
  private readonly names = new Map<string, { name: string; role: User['role'] }>();

  constructor(
    @InjectModel(ActivityLog.name) private readonly logModel: Model<ActivityLog>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  /** Records an action. Never throws: traceability must not break the real operation. */
  async log(actor: AuthUser, entry: ActivityEntry) {
    try {
      const who = await this.actor(actor);
      await this.logModel.create({
        actorId: new Types.ObjectId(actor.userId),
        actorName: who.name,
        actorRole: who.role,
        ...entry,
      });
    } catch (err) {
      this.logger.error(`Échec journalisation ${entry.action}: ${(err as Error).message}`);
    }
  }

  async list(f: ActivityFilters) {
    const query: FilterQuery<ActivityLog> = {};
    if (f.actorId) query.actorId = new Types.ObjectId(f.actorId);
    if (f.playerId) query.playerId = new Types.ObjectId(f.playerId);
    if (f.action) {
      query.action = f.action.includes('.') ? f.action : { $regex: `^${f.action.replace(/[^a-z]/g, '')}\\.` };
    }
    if (f.from || f.to) {
      query.createdAt = {};
      if (f.from) query.createdAt.$gte = new Date(`${f.from}T00:00:00`);
      if (f.to) query.createdAt.$lte = new Date(`${f.to}T23:59:59.999`);
    }

    const limit = Math.min(Math.max(f.limit ?? 50, 1), 200);
    const page = Math.max(f.page ?? 1, 1);
    const [items, total] = await Promise.all([
      this.logModel
        .find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.logModel.countDocuments(query),
    ]);
    return { items, total, page, pages: Math.ceil(total / limit) };
  }

  /** Per-actor counters for a month. */
  async summary(month: number, year: number) {
    const { start, end } = monthRange(month, year);
    const rows = await this.logModel.aggregate<{
      _id: Types.ObjectId;
      actorName: string;
      actorRole: string;
      attendance: number;
      paid: number;
      unpaid: number;
      sheets: number;
      other: number;
      total: number;
      lastAt: Date;
    }>([
      { $match: { createdAt: { $gte: start, $lt: end } } },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: '$actorId',
          actorName: { $last: '$actorName' },
          actorRole: { $last: '$actorRole' },
          attendance: { $sum: { $cond: [{ $eq: ['$action', 'attendance.mark'] }, 1, 0] } },
          paid: { $sum: { $cond: [{ $eq: ['$action', 'payment.paid'] }, 1, 0] } },
          unpaid: { $sum: { $cond: [{ $eq: ['$action', 'payment.unpaid'] }, 1, 0] } },
          sheets: { $sum: { $cond: [{ $eq: ['$action', 'sheet.update'] }, 1, 0] } },
          total: { $sum: 1 },
          lastAt: { $max: '$createdAt' },
        },
      },
    ]);

    // Include every coach, even with no activity this month.
    const coaches = await this.userModel.find({ role: { $in: ['coach', 'admin'] } }).select('name role').lean();
    const byId = new Map(rows.map((r) => [r._id.toString(), r]));
    return coaches
      .map((c) => {
        const r = byId.get(c._id.toString());
        return {
          actorId: c._id,
          actorName: c.name,
          actorRole: c.role,
          attendance: r?.attendance ?? 0,
          paid: r?.paid ?? 0,
          unpaid: r?.unpaid ?? 0,
          sheets: r?.sheets ?? 0,
          total: r?.total ?? 0,
          lastAt: r?.lastAt ?? null,
        };
      })
      .sort((a, b) => (a.actorRole === b.actorRole ? b.total - a.total : a.actorRole === 'coach' ? -1 : 1));
  }

  private async actor(actor: AuthUser) {
    const cached = this.names.get(actor.userId);
    if (cached) return cached;
    const user = await this.userModel.findById(actor.userId).select('name role').lean();
    const value = { name: user?.name ?? 'Utilisateur supprimé', role: user?.role ?? actor.role };
    this.names.set(actor.userId, value);
    return value;
  }
}
