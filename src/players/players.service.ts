import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { ActivityService } from '../activity/activity.service';
import { Attendance } from '../attendance/schemas/attendance.schema';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { computeAge } from '../common/utils/date.util';
import { Payment } from '../payments/schemas/payment.schema';
import { User } from '../users/schemas/user.schema';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { UpsertTechnicalSheetDto } from './dto/upsert-technical-sheet.dto';
import { Player, PlayerDocument } from './schemas/player.schema';
import { TechnicalSheet } from './schemas/technical-sheet.schema';

const FIELD_LABELS: Record<string, string> = {
  name: 'nom',
  dateOfBirth: 'date de naissance',
  parentId: 'parent',
  category: 'catégorie',
  monthlyFee: 'cotisation',
  active: 'statut',
  height: 'taille',
  weight: 'poids',
  strongHand: 'main forte',
  mainPosition: 'poste principal',
  secondaryPosition: 'poste secondaire',
  jerseyNumber: 'maillot',
  notes: 'remarques',
};

/** Keys of `next` whose value differs from `prev` (dates/ObjectIds compared as strings). */
function changedFields(prev: Record<string, unknown>, next: Record<string, unknown>) {
  const norm = (v: unknown) => {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (v == null || v === '') return '';
    const s = String(v);
    return /^\d{4}-\d{2}-\d{2}T/.test(s) ? s.slice(0, 10) : s;
  };
  return Object.keys(next).filter((k) => next[k] !== undefined && norm(prev[k]) !== norm(next[k]));
}

export interface PlayerFilters {
  category?: string;
  active?: boolean;
}

@Injectable()
export class PlayersService {
  constructor(
    @InjectModel(Player.name) private readonly playerModel: Model<Player>,
    @InjectModel(TechnicalSheet.name) private readonly sheetModel: Model<TechnicalSheet>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<Attendance>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<Payment>,
    private readonly activity: ActivityService,
  ) {}

  /** Mongo filter restricting players to what the current user may see: staff see everyone, parents their children. */
  scopeFilter(user: AuthUser): FilterQuery<Player> {
    return user.role === Role.Parent ? { parentId: new Types.ObjectId(user.userId) } : {};
  }

  assertAccess(user: AuthUser, player: Player) {
    if (user.role !== Role.Parent) return;
    if (player.parentId.toString() !== user.userId) {
      throw new ForbiddenException("Vous n'avez pas accès à ce joueur");
    }
  }

  /** Loads a player and enforces ownership. Reused by attendance & payments. */
  async getAccessiblePlayer(id: string, user: AuthUser): Promise<PlayerDocument> {
    const player = await this.playerModel.findById(id);
    if (!player) throw new NotFoundException('Joueur introuvable');
    this.assertAccess(user, player);
    return player;
  }

  findAll(user: AuthUser, filters: PlayerFilters = {}) {
    const query: FilterQuery<Player> = { ...this.scopeFilter(user) };
    if (filters.category) query.category = filters.category;
    if (filters.active !== undefined) query.active = filters.active;

    return this.playerModel
      .find(query)
      .populate('parentId', 'name email phone')
      .sort({ category: 1, name: 1 })
      .lean();
  }

  /** Parent view: every child with its technical sheet and computed age. */
  async findMine(user: AuthUser) {
    const players = await this.playerModel
      .find(this.scopeFilter(user))
      .sort({ name: 1 })
      .lean();
    const sheets = await this.sheetModel
      .find({ playerId: { $in: players.map((p) => p._id) } })
      .lean();
    const byPlayer = new Map(sheets.map((s) => [s.playerId.toString(), s]));

    return players.map((p) => ({
      ...p,
      age: computeAge(p.dateOfBirth),
      technicalSheet: byPlayer.get(p._id.toString()) ?? null,
    }));
  }

  async findOne(id: string, user: AuthUser) {
    await this.getAccessiblePlayer(id, user);
    const player = await this.playerModel
      .findById(id)
      .populate('parentId', 'name email phone')
      .lean();
    const technicalSheet = await this.sheetModel.findOne({ playerId: id }).lean();
    return { ...player!, age: computeAge(player!.dateOfBirth), technicalSheet };
  }

  async create(dto: CreatePlayerDto, user: AuthUser) {
    await this.assertUserRole(dto.parentId, Role.Parent);
    const player = await this.playerModel.create(dto);
    await this.activity.log(user, {
      action: 'player.create',
      playerId: player._id,
      playerName: player.name,
      summary: `a inscrit ${player.name} (${player.category})`,
      meta: { category: player.category, monthlyFee: player.monthlyFee },
    });
    return player.toObject();
  }

  async update(id: string, dto: UpdatePlayerDto, user: AuthUser) {
    const player = await this.getAccessiblePlayer(id, user);
    // Parents may only correct the name and birth date of their own child.
    const data: UpdatePlayerDto = { ...dto };
    if (user.role === Role.Parent) {
      delete data.parentId;
      delete data.category;
      delete data.monthlyFee;
      delete data.active;
    }
    if (data.parentId) await this.assertUserRole(data.parentId, Role.Parent);

    const changed = changedFields(player.toObject() as unknown as Record<string, unknown>, data as Record<string, unknown>);
    player.set(data);
    await player.save();
    if (changed.length) {
      await this.activity.log(user, {
        action: 'player.update',
        playerId: player._id,
        playerName: player.name,
        summary: `a modifié le profil de ${player.name} (${changed.map((f) => FIELD_LABELS[f] ?? f).join(', ')})`,
        meta: { fields: changed },
      });
    }
    return player.toObject();
  }

  async remove(id: string, user: AuthUser) {
    const player = await this.getAccessiblePlayer(id, user);
    await Promise.all([
      this.sheetModel.deleteOne({ playerId: player._id }),
      this.attendanceModel.deleteMany({ playerId: player._id }),
      this.paymentModel.deleteMany({ playerId: player._id }),
    ]);
    await player.deleteOne();
    await this.activity.log(user, {
      action: 'player.delete',
      playerName: player.name,
      summary: `a supprimé ${player.name} (${player.category}) et son historique`,
      meta: { category: player.category },
    });
    return { deleted: true };
  }

  async getTechnicalSheet(playerId: string, user: AuthUser) {
    await this.getAccessiblePlayer(playerId, user);
    return (await this.sheetModel.findOne({ playerId }).lean()) ?? null;
  }

  async upsertTechnicalSheet(playerId: string, dto: UpsertTechnicalSheetDto, user: AuthUser) {
    const player = await this.getAccessiblePlayer(playerId, user);
    // Parents may fill the sheet, but the coach's notes stay staff-only.
    const data: UpsertTechnicalSheetDto = { ...dto };
    if (user.role === Role.Parent) delete data.notes;

    const before = (await this.sheetModel.findOne({ playerId: player._id }).lean()) ?? {};
    const saved = await this.sheetModel
      .findOneAndUpdate(
        { playerId: player._id },
        { $set: { ...data, updatedBy: new Types.ObjectId(user.userId) } },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
      )
      .lean();

    const changed = changedFields(before as Record<string, unknown>, data as Record<string, unknown>);
    if (changed.length) {
      await this.activity.log(user, {
        action: 'sheet.update',
        playerId: player._id,
        playerName: player.name,
        summary: `a mis à jour la fiche technique de ${player.name} (${changed.map((f) => FIELD_LABELS[f] ?? f).join(', ')})`,
        meta: { fields: changed },
      });
    }
    return saved;
  }

  private async assertUserRole(id: string, role: Role) {
    const exists = await this.userModel.exists({ _id: id, role });
    if (!exists) throw new BadRequestException(`Aucun utilisateur "${role}" avec l'id ${id}`);
  }
}
