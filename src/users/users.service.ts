import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { FilterQuery, Model } from 'mongoose';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { Player } from '../players/schemas/player.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';

const SALT_ROUNDS = 10;
const ROLE_LABELS: Record<Role, string> = { admin: 'admin', coach: 'coach', parent: 'parent' };

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Player.name) private readonly playerModel: Model<Player>,
    private readonly activity: ActivityService,
  ) {}

  hashPassword(plain: string) {
    return bcrypt.hash(plain, SALT_ROUNDS);
  }

  /** Returns the created user plus the plain password so the coach can hand it to the parent. */
  async create(dto: CreateUserDto, actor: AuthUser) {
    if (actor.role === Role.Coach && dto.role !== Role.Parent) {
      throw new ForbiddenException('Un coach ne peut créer que des comptes parents');
    }

    const email = dto.email.toLowerCase().trim();
    if (await this.userModel.exists({ email })) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    const plainPassword = dto.password ?? this.generatePassword();
    const user = await this.userModel.create({
      ...dto,
      email,
      password: await this.hashPassword(plainPassword),
      createdBy: actor.userId,
    });
    await this.activity.log(actor, {
      action: 'user.create',
      targetUserName: user.name,
      summary: `a créé le compte ${ROLE_LABELS[user.role]} de ${user.name} (${email})`,
      meta: { role: user.role, email },
    });

    return { user: user.toJSON(), credentials: { email, password: plainPassword } };
  }

  findAll(actor: AuthUser, role?: Role) {
    const filter: FilterQuery<User> = {};
    if (role) filter.role = role;
    // Coaches manage every parent account, but never see other staff accounts.
    if (actor.role === Role.Coach) filter.role = Role.Parent;
    return this.userModel.find(filter).sort({ name: 1 }).lean();
  }

  async findById(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  findByEmailWithPassword(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).select('+password');
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthUser) {
    const user = await this.findById(id);
    this.assertCanManage(user, actor);

    if (dto.email && dto.email.toLowerCase().trim() !== user.email) {
      const email = dto.email.toLowerCase().trim();
      if (await this.userModel.exists({ email, _id: { $ne: id } })) {
        throw new ConflictException('Cet email est déjà utilisé');
      }
      user.email = email;
    }
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.password) user.password = await this.hashPassword(dto.password);

    const changed = user.modifiedPaths().filter((p) => p !== 'password');
    await user.save();
    if (changed.length || dto.password) {
      const what = [
        ...(dto.password ? ['réinitialisé le mot de passe'] : []),
        ...(changed.length ? [`modifié ${changed.map((p) => ({ name: 'nom', email: 'email', phone: 'téléphone' })[p] ?? p).join(', ')}`] : []),
      ].join(' et ');
      await this.activity.log(actor, {
        action: 'user.update',
        targetUserName: user.name,
        summary: `a ${what} du compte de ${user.name}`,
        // Never log the password itself.
        meta: { fields: changed, passwordReset: Boolean(dto.password) },
      });
    }
    return user.toJSON();
  }

  async remove(id: string, actor: AuthUser) {
    const user = await this.findById(id);
    this.assertCanManage(user, actor);
    if (user.id === actor.userId) {
      throw new ConflictException('Impossible de supprimer votre propre compte');
    }

    const linked = await this.playerModel.exists({ parentId: user._id });
    if (linked) {
      throw new ConflictException('Des joueurs sont encore liés à ce compte');
    }
    await user.deleteOne();
    await this.activity.log(actor, {
      action: 'user.delete',
      targetUserName: user.name,
      summary: `a supprimé le compte ${ROLE_LABELS[user.role]} de ${user.name} (${user.email})`,
      meta: { role: user.role, email: user.email },
    });
    return { deleted: true };
  }

  private assertCanManage(target: UserDocument, actor: AuthUser) {
    if (actor.role === Role.Admin) return;
    if (target.role !== Role.Parent) throw new ForbiddenException();
  }

  private generatePassword() {
    return randomBytes(6).toString('base64url'); // 8 URL-safe chars
  }
}
