import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PlayersService } from '../players/players.service';
import { Player } from '../players/schemas/player.schema';
import { ActivityService } from '../activity/activity.service';
import { UpsertPaymentDto } from './dto/upsert-payment.dto';
import { Payment } from './schemas/payment.schema';

type PaymentWithMarker = Omit<Payment, 'markedBy'> & { markedBy: { name: string } | null; updatedAt: Date };

const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<Payment>,
    @InjectModel(Player.name) private readonly playerModel: Model<Player>,
    private readonly playersService: PlayersService,
    private readonly activity: ActivityService,
  ) {}

  /** Mark a month as paid/unpaid (one record per player per month). */
  async upsert(dto: UpsertPaymentDto, user: AuthUser) {
    const player = await this.playersService.getAccessiblePlayer(dto.playerId, user);
    const paid = dto.status === 'paid';
    const filter = { playerId: player._id, month: dto.month, year: dto.year };
    const previous = await this.paymentModel.findOne(filter).select('status').lean();

    const update = {
      $set: {
        status: dto.status,
        amount: dto.amount ?? player.monthlyFee,
        markedBy: new Types.ObjectId(user.userId),
        ...(paid ? { paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date() } : {}),
      },
      ...(paid ? {} : { $unset: { paymentDate: 1 as const } }),
    };

    const saved = await this.paymentModel
      .findOneAndUpdate(filter, update, { upsert: true, new: true, runValidators: true })
      .lean();

    const previousStatus = previous?.status ?? 'unpaid';
    if (previousStatus !== dto.status || !previous) {
      const period = `${MONTHS_FR[dto.month - 1]} ${dto.year}`;
      await this.activity.log(user, {
        action: paid ? 'payment.paid' : 'payment.unpaid',
        playerId: player._id,
        playerName: player.name,
        summary: paid
          ? `a marqué ${player.name} khalès pour ${period} (${saved!.amount} DT)`
          : `a repassé ${player.name} en non khalès pour ${period}`,
        meta: { month: dto.month, year: dto.year, amount: saved!.amount, previousStatus: previous?.status ?? null },
      });
    }
    return saved;
  }

  /** Month grid for staff: every active player in scope; missing records count as unpaid. */
  async getMonth(month: number, year: number, user: AuthUser, category?: string) {
    const players = await this.playerModel
      .find({
        ...this.playersService.scopeFilter(user),
        active: true,
        ...(category ? { category } : {}),
      })
      .select('name category monthlyFee')
      .sort({ category: 1, name: 1 })
      .lean();

    const payments = await this.paymentModel
      .find({ month, year, playerId: { $in: players.map((p) => p._id) } })
      .populate('markedBy', 'name')
      .lean<PaymentWithMarker[]>();
    const byPlayer = new Map(payments.map((p) => [p.playerId.toString(), p]));

    return players.map((p) => {
      const pay = byPlayer.get(p._id.toString());
      return {
        playerId: p._id,
        name: p.name,
        category: p.category,
        status: pay?.status ?? 'unpaid',
        amount: pay?.amount ?? p.monthlyFee,
        paymentDate: pay?.paymentDate ?? null,
        markedByName: pay ? (pay.markedBy?.name ?? 'Utilisateur supprimé') : null,
        updatedAt: pay?.updatedAt ?? null,
      };
    });
  }

  /**
   * Year grid for staff: one row per player, 12 month cells.
   * A cell is null when no record exists (unpaid if the month has started, "not due" otherwise).
   */
  async getYear(year: number, user: AuthUser, category?: string) {
    const players = await this.playerModel
      .find({ ...this.playersService.scopeFilter(user), active: true, ...(category ? { category } : {}) })
      .select('name category monthlyFee createdAt')
      .sort({ category: 1, name: 1 })
      .lean<(Player & { _id: Types.ObjectId; createdAt: Date })[]>();
    const ids = players.map((p) => p._id);

    const payments = await this.paymentModel
      .find({ year, playerId: { $in: ids } })
      .select('playerId month status amount paymentDate markedBy')
      .populate('markedBy', 'name')
      .lean<PaymentWithMarker[]>();
    const key =(id: unknown, m: number) => `${String(id)}-${m}`;
    const byCell = new Map(payments.map((p) => [key(p.playerId, p.month), p]));

    // Earliest payment record per player (as year*12 + monthIndex), across all years.
    const firsts = await this.paymentModel.aggregate<{ _id: Types.ObjectId; first: number }>([
      { $match: { playerId: { $in: ids } } },
      { $group: { _id: '$playerId', first: { $min: { $add: [{ $multiply: ['$year', 12] }, '$month', -1] } } } },
    ]);
    const firstByPlayer = new Map(firsts.map((f) => [f._id.toString(), f.first]));

    return players.map((p) => {
      // A player owes fees from registration, or from their first recorded payment if earlier.
      const created = p.createdAt.getFullYear() * 12 + p.createdAt.getMonth();
      const start = Math.min(created, firstByPlayer.get(p._id.toString()) ?? created);
      return {
        playerId: p._id,
        name: p.name,
        category: p.category,
        monthlyFee: p.monthlyFee,
        since: { year: Math.floor(start / 12), month: (start % 12) + 1 },
        months: Array.from({ length: 12 }, (_, i) => {
          const pay = byCell.get(key(p._id, i + 1));
          return pay
            ? {
                status: pay.status,
                amount: pay.amount,
                paymentDate: pay.paymentDate ?? null,
                markedByName: pay.markedBy?.name ?? 'Utilisateur supprimé',
              }
            : null;
        }),
      };
    });
  }

  async getPlayerHistory(playerId: string, user: AuthUser) {
    await this.playersService.getAccessiblePlayer(playerId, user);
    return this.paymentModel
      .find({ playerId })
      .select('month year status amount paymentDate')
      .sort({ year: -1, month: -1 })
      .lean();
  }

  /** Monthly financial stats + a 6-month collected trend. */
  async getStats(month: number, year: number, user: AuthUser) {
    const scope = this.playersService.scopeFilter(user);

    const [feeAgg] = await this.playerModel.aggregate<{ expected: number; players: number }>([
      { $match: { ...scope, active: true } },
      { $group: { _id: null, expected: { $sum: '$monthlyFee' }, players: { $sum: 1 } } },
    ]);
    const expected = feeAgg?.expected ?? 0;
    const activePlayers = feeAgg?.players ?? 0;

    const scopedIds = await this.playerModel.find(scope).distinct('_id');

    const [paidAgg] = await this.paymentModel.aggregate<{ collected: number; paidCount: number }>([
      { $match: { month, year, status: 'paid', playerId: { $in: scopedIds } } },
      { $group: { _id: null, collected: { $sum: '$amount' }, paidCount: { $sum: 1 } } },
    ]);
    const collected = paidAgg?.collected ?? 0;
    const paidCount = paidAgg?.paidCount ?? 0;

    // Last 6 months including the requested one.
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(Date.UTC(year, month - 1 - (5 - i), 1));
      return { month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
    });
    const trendAgg = await this.paymentModel.aggregate<{
      _id: { month: number; year: number };
      collected: number;
    }>([
      {
        $match: {
          status: 'paid',
          playerId: { $in: scopedIds },
          $or: months.map((m) => ({ month: m.month, year: m.year })),
        },
      },
      { $group: { _id: { month: '$month', year: '$year' }, collected: { $sum: '$amount' } } },
    ]);
    const trend = months.map((m) => ({
      ...m,
      collected:
        trendAgg.find((t) => t._id.month === m.month && t._id.year === m.year)?.collected ?? 0,
    }));

    return {
      month,
      year,
      activePlayers,
      expected,
      collected,
      outstanding: Math.max(expected - collected, 0),
      paidCount,
      unpaidCount: Math.max(activePlayers - paidCount, 0),
      collectionRate: activePlayers ? Math.round((paidCount / activePlayers) * 100) : 0,
      trend,
    };
  }
}
