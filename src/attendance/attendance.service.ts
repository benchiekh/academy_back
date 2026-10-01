import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { monthRange, toUtcDay } from '../common/utils/date.util';
import { PlayersService } from '../players/players.service';
import { Player } from '../players/schemas/player.schema';
import { BulkAttendanceDto } from './dto/bulk-attendance.dto';
import { Attendance, AttendanceStatus } from './schemas/attendance.schema';

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

type RecordWithMarker = Attendance & { markedBy: { name: string } | null; updatedAt: Date };

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<Attendance>,
    @InjectModel(Player.name) private readonly playerModel: Model<Player>,
    private readonly playersService: PlayersService,
    private readonly activity: ActivityService,
  ) {}

  /** Upserts one record per player for the given day (the daily roll call). */
  async bulkMark(dto: BulkAttendanceDto, user: AuthUser) {
    const date = toUtcDay(dto.date);
    const ids = [...new Set(dto.records.map((r) => r.playerId))];

    const allowed = await this.playerModel.countDocuments({
      ...this.playersService.scopeFilter(user),
      _id: { $in: ids },
    });
    if (allowed !== ids.length) {
      throw new ForbiddenException('Certains joueurs sont introuvables ou inaccessibles');
    }

    const markedBy = new Types.ObjectId(user.userId);
    const result = await this.attendanceModel.bulkWrite(
      dto.records.map((r) => ({
        updateOne: {
          filter: { playerId: new Types.ObjectId(r.playerId), date },
          update: { $set: { status: r.status, markedBy } },
          upsert: true,
        },
      })),
    );

    const counts: Record<AttendanceStatus, number> = { present: 0, absent: 0, excused: 0 };
    dto.records.forEach((r) => counts[r.status]++);
    const categories = (await this.playerModel.distinct('category', { _id: { $in: ids } })).sort();
    const day = date.toLocaleDateString('fr-FR', { timeZone: 'UTC' });
    await this.activity.log(user, {
      action: 'attendance.mark',
      summary: `a fait l'appel du ${day} (${categories.join(', ')}) — ${plural(counts.present, 'présent')}, ${plural(counts.absent, 'absent')}, ${plural(counts.excused, 'justifié')}`,
      meta: { date, counts, categories, players: ids.length },
    });

    return { date, upserted: result.upsertedCount, modified: result.modifiedCount };
  }

  /** Roll-call sheet for a day: every active player in scope with their status (or null), plus who last marked it. */
  async getDay(dateInput: string, user: AuthUser, category?: string) {
    const date = toUtcDay(dateInput);
    const players = await this.playerModel
      .find({
        ...this.playersService.scopeFilter(user),
        active: true,
        ...(category ? { category } : {}),
      })
      .select('name category')
      .sort({ category: 1, name: 1 })
      .lean();

    const records = await this.attendanceModel
      .find({ date, playerId: { $in: players.map((p) => p._id) } })
      .populate('markedBy', 'name')
      .lean<RecordWithMarker[]>();
    const byPlayer = new Map(records.map((r) => [r.playerId.toString(), r.status]));
    const latest = records.reduce<RecordWithMarker | null>((a, r) => (!a || r.updatedAt > a.updatedAt ? r : a), null);

    return {
      date,
      markedBy: latest ? { name: latest.markedBy?.name ?? 'Utilisateur supprimé', at: latest.updatedAt } : null,
      players: players.map((p) => ({
        playerId: p._id,
        name: p.name,
        category: p.category,
        status: byPlayer.get(p._id.toString()) ?? null,
      })),
    };
  }

  /** A player's attendance for a month, plus totals. */
  async getPlayerMonth(playerId: string, month: number, year: number, user: AuthUser) {
    await this.playersService.getAccessiblePlayer(playerId, user);
    const { start, end } = monthRange(month, year);

    const records = await this.attendanceModel
      .find({ playerId, date: { $gte: start, $lt: end } })
      .select('date status')
      .sort({ date: 1 })
      .lean();

    const summary: Record<AttendanceStatus, number> = { present: 0, absent: 0, excused: 0 };
    records.forEach((r) => summary[r.status]++);
    const total = records.length;
    const rate = total ? Math.round((summary.present / total) * 100) : null;

    return { month, year, records, summary: { ...summary, total, rate } };
  }
}
