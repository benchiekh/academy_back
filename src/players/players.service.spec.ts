import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { PlayersService } from './players.service';

/**
 * QA — Restrictions d'accès sur les joueurs et la fiche technique.
 *
 * Règles métier testées (ajoutées récemment — risque de régression !) :
 * 1. Un parent ne voit/édite QUE ses propres enfants (sinon 403)
 * 2. PATCH : un parent ne peut changer QUE nom + date de naissance
 *    (category, monthlyFee, active, parentId sont supprimés de sa requête)
 * 3. PUT fiche technique : un parent ne peut PAS écrire le champ `notes`
 *    (réservé au coach) — même s'il l'envoie dans la requête
 */
describe('PlayersService (QA)', () => {
  let service: PlayersService;
  let playerModel: Record<string, jest.Mock>;
  let sheetModel: Record<string, jest.Mock>;
  let activity: { log: jest.Mock };

  const parentId = new Types.ObjectId();
  const otherParentId = new Types.ObjectId();
  const childId = new Types.ObjectId();

  const parent: AuthUser = { userId: parentId.toHexString(), role: Role.Parent };
  const admin: AuthUser = { userId: new Types.ObjectId().toHexString(), role: Role.Admin };

  /** Simule un document joueur Mongoose avec les méthodes utilisées par le service. */
  const fakePlayerDoc = (overrides: Record<string, unknown> = {}) => {
    const doc: Record<string, unknown> & { set: jest.Mock; save: jest.Mock; toObject: () => unknown } = {
      _id: childId,
      name: 'Yassine',
      dateOfBirth: new Date('2013-05-20'),
      parentId,
      category: 'U13',
      monthlyFee: 50,
      active: true,
      set: jest.fn((patch: Record<string, unknown>) => Object.assign(doc, patch)),
      save: jest.fn().mockResolvedValue(undefined),
      toObject: () => ({}),
      ...overrides,
    };
    doc.toObject = () => ({
      name: doc.name,
      dateOfBirth: doc.dateOfBirth,
      parentId: doc.parentId,
      category: doc.category,
      monthlyFee: doc.monthlyFee,
      active: doc.active,
    });
    return doc;
  };

  beforeEach(() => {
    playerModel = { findById: jest.fn(), find: jest.fn(), create: jest.fn() };
    sheetModel = { findOne: jest.fn(), findOneAndUpdate: jest.fn(), find: jest.fn() };
    activity = { log: jest.fn() };
    service = new PlayersService(
      playerModel as never,
      sheetModel as never,
      { exists: jest.fn() } as never, // userModel
      {} as never, // attendanceModel
      {} as never, // paymentModel
      activity as unknown as ActivityService,
    );
  });

  describe('scopeFilter (filtrage des listes)', () => {
    it('un parent est limité à ses enfants', () => {
      const filter = service.scopeFilter(parent);
      expect(filter.parentId).toEqual(parentId);
    });

    it('le staff (admin/coach) voit tout le monde', () => {
      expect(service.scopeFilter(admin)).toEqual({});
    });
  });

  describe('getAccessiblePlayer (contrôle de propriété)', () => {
    it('renvoie 404 si le joueur n’existe pas', async () => {
      playerModel.findById.mockResolvedValue(null);
      await expect(service.getAccessiblePlayer(childId.toHexString(), admin)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('renvoie 403 si un parent vise l’enfant d’un AUTRE parent', async () => {
      playerModel.findById.mockResolvedValue(fakePlayerDoc({ parentId: otherParentId }));
      await expect(service.getAccessiblePlayer(childId.toHexString(), parent)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('autorise un parent sur SON enfant', async () => {
      playerModel.findById.mockResolvedValue(fakePlayerDoc());
      await expect(service.getAccessiblePlayer(childId.toHexString(), parent)).resolves.toBeTruthy();
    });
  });

  describe('update (modification du profil joueur)', () => {
    it('PARENT : seuls nom + date de naissance sont appliqués, le reste est ignoré', async () => {
      const doc = fakePlayerDoc();
      playerModel.findById.mockResolvedValue(doc);

      await service.update(
        childId.toHexString(),
        { name: 'Nouveau Nom', dateOfBirth: '2014-02-11', category: 'U19', monthlyFee: 1, active: false },
        parent,
      );

      // Le patch réellement appliqué au document
      const applied = doc.set.mock.calls[0][0] as Record<string, unknown>;
      expect(applied.name).toBe('Nouveau Nom');
      expect(applied.dateOfBirth).toBe('2014-02-11');
      // Les champs sensibles ont été supprimés de la requête du parent
      expect(applied).not.toHaveProperty('category');
      expect(applied).not.toHaveProperty('monthlyFee');
      expect(applied).not.toHaveProperty('active');
      expect(applied).not.toHaveProperty('parentId');
    });

    it('ADMIN : tous les champs sont appliqués', async () => {
      const doc = fakePlayerDoc();
      playerModel.findById.mockResolvedValue(doc);

      await service.update(childId.toHexString(), { category: 'U15', monthlyFee: 65, active: false }, admin);

      const applied = doc.set.mock.calls[0][0] as Record<string, unknown>;
      expect(applied).toMatchObject({ category: 'U15', monthlyFee: 65, active: false });
    });
  });

  describe('upsertTechnicalSheet (fiche technique)', () => {
    const mockSheetChain = (saved: unknown) => {
      sheetModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      sheetModel.findOneAndUpdate.mockReturnValue({ lean: jest.fn().mockResolvedValue(saved) });
    };

    it('PARENT : le champ notes est supprimé même s’il est envoyé', async () => {
      playerModel.findById.mockResolvedValue(fakePlayerDoc());
      mockSheetChain({ height: 150 });

      await service.upsertTechnicalSheet(childId.toHexString(), { height: 150, notes: 'tentative parent' }, parent);

      const setPayload = (sheetModel.findOneAndUpdate.mock.calls[0][1] as { $set: Record<string, unknown> }).$set;
      expect(setPayload.height).toBe(150);
      expect(setPayload).not.toHaveProperty('notes');
      // updatedBy est toujours enregistré pour la traçabilité
      expect(setPayload.updatedBy).toEqual(parentId);
    });

    it('ADMIN : le champ notes est conservé', async () => {
      playerModel.findById.mockResolvedValue(fakePlayerDoc());
      mockSheetChain({ notes: 'Très bon joueur' });

      await service.upsertTechnicalSheet(childId.toHexString(), { notes: 'Très bon joueur' }, admin);

      const setPayload = (sheetModel.findOneAndUpdate.mock.calls[0][1] as { $set: Record<string, unknown> }).$set;
      expect(setPayload.notes).toBe('Très bon joueur');
    });

    it('une modification de la fiche est journalisée (traçabilité)', async () => {
      playerModel.findById.mockResolvedValue(fakePlayerDoc());
      mockSheetChain({ height: 150 });

      await service.upsertTechnicalSheet(childId.toHexString(), { height: 150 }, admin);

      expect(activity.log).toHaveBeenCalledWith(admin, expect.objectContaining({ action: 'sheet.update' }));
    });
  });
});
