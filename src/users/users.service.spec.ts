import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { UsersService } from './users.service';

/**
 * QA — Gestion des comptes utilisateurs.
 *
 * Matrice des droits testée :
 * | Action                        | admin | coach            | parent |
 * |-------------------------------|-------|------------------|--------|
 * | Créer un parent               |  ✅   | ✅               | ❌     |
 * | Créer un coach / admin        |  ✅   | ❌ interdit      | ❌     |
 * | Modifier un parent            |  ✅   | ✅               | ❌     |
 * | Modifier un admin/coach       |  ✅   | ❌ interdit      | ❌     |
 * | Supprimer son propre compte   |  ❌   | ❌               | ❌     |
 * | Supprimer un parent avec enfants liés | ❌ (conflit) | ❌ | ❌ |
 */
describe('UsersService (QA)', () => {
  let service: UsersService;
  let userModel: { exists: jest.Mock; create: jest.Mock; findById: jest.Mock };
  let playerModel: { exists: jest.Mock };
  let activity: { log: jest.Mock };

  const admin: AuthUser = { userId: 'admin-1', role: Role.Admin };
  const coach: AuthUser = { userId: 'coach-1', role: Role.Coach };

  /** Simule un document Mongoose utilisateur. */
  const fakeUserDoc = (overrides: Record<string, unknown> = {}) => ({
    id: 'u1',
    role: Role.Parent,
    name: 'Parent Test',
    email: 'parent@test.com',
    phone: undefined,
    modifiedPaths: jest.fn(() => []),
    save: jest.fn().mockResolvedValue(undefined),
    deleteOne: jest.fn().mockResolvedValue(undefined),
    toJSON: jest.fn(() => ({ id: 'u1', email: 'parent@test.com' })),
    ...overrides,
  });

  beforeEach(() => {
    userModel = { exists: jest.fn(), create: jest.fn(), findById: jest.fn() };
    playerModel = { exists: jest.fn() };
    activity = { log: jest.fn() };
    service = new UsersService(userModel as never, playerModel as never, activity as unknown as ActivityService);
  });

  describe('create', () => {
    it('interdit à un coach de créer un compte coach (escalade de privilèges)', async () => {
      await expect(service.create({ name: 'X', email: 'x@x.com', role: Role.Coach }, coach)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.create({ name: 'X', email: 'x@x.com', role: Role.Admin }, coach)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuse un email déjà utilisé (409)', async () => {
      userModel.exists.mockResolvedValue({ _id: 'autre' }); // email trouvé en base
      await expect(service.create({ name: 'X', email: 'Pris@Test.com ', role: Role.Parent }, admin)).rejects.toBeInstanceOf(ConflictException);
    });

    it('crée un parent avec un mot de passe généré et journalise l’action', async () => {
      userModel.exists.mockResolvedValue(null);
      const doc = fakeUserDoc();
      userModel.create.mockResolvedValue(doc);

      const res = await service.create({ name: 'Parent Test', email: 'Parent@Test.com', role: Role.Parent }, coach);

      // L'email est normalisé (minuscules + trim) — sinon doublons possibles
      expect(userModel.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'parent@test.com', createdBy: coach.userId }));
      // Le mot de passe en clair n'est retourné QU'UNE fois, à la création
      expect(res.credentials.password).toBeTruthy();
      expect(activity.log).toHaveBeenCalledWith(coach, expect.objectContaining({ action: 'user.create' }));
    });
  });

  describe('update', () => {
    it('interdit à un coach de modifier un compte admin', async () => {
      userModel.findById.mockResolvedValue(fakeUserDoc({ role: Role.Admin }));
      await expect(service.update('u1', { name: 'hack' }, coach)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('autorise un coach à modifier le téléphone d’un parent', async () => {
      const doc = fakeUserDoc();
      userModel.findById.mockResolvedValue(doc);
      await service.update('u1', { phone: '22111222' }, coach);
      expect(doc.phone).toBe('22111222');
      expect(doc.save).toHaveBeenCalled();
    });

    it('refuse de changer l’email vers un email déjà pris (409)', async () => {
      userModel.findById.mockResolvedValue(fakeUserDoc());
      userModel.exists.mockResolvedValue({ _id: 'autre' });
      await expect(service.update('u1', { email: 'pris@test.com' }, admin)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('remove', () => {
    it('interdit de supprimer son propre compte', async () => {
      userModel.findById.mockResolvedValue(fakeUserDoc({ id: admin.userId, role: Role.Admin }));
      await expect(service.remove(admin.userId, admin)).rejects.toBeInstanceOf(ConflictException);
    });

    it('interdit de supprimer un parent qui a encore des joueurs liés', async () => {
      userModel.findById.mockResolvedValue(fakeUserDoc({ id: 'p1' }));
      playerModel.exists.mockResolvedValue({ _id: 'joueur-lié' });
      await expect(service.remove('p1', admin)).rejects.toBeInstanceOf(ConflictException);
    });

    it('interdit à un coach de supprimer un compte admin', async () => {
      userModel.findById.mockResolvedValue(fakeUserDoc({ id: 'a9', role: Role.Admin }));
      await expect(service.remove('a9', coach)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('supprime un parent sans joueurs liés et journalise', async () => {
      const doc = fakeUserDoc({ id: 'p1' });
      userModel.findById.mockResolvedValue(doc);
      playerModel.exists.mockResolvedValue(null);
      await service.remove('p1', admin);
      expect(doc.deleteOne).toHaveBeenCalled();
      expect(activity.log).toHaveBeenCalledWith(admin, expect.objectContaining({ action: 'user.delete' }));
    });
  });
});
