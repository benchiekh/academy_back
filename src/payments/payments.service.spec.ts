import { Types } from 'mongoose';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { PlayersService } from '../players/players.service';
import { PaymentsService } from './payments.service';

/**
 * QA — Paiements mensuels.
 *
 * Règles métier testées :
 * 1. Marquer « payé » avec un montant PARTIEL (ex. 30 DT sur 35 DT) → le montant réel est enregistré
 * 2. Sans montant fourni → la cotisation du joueur s'applique par défaut
 * 3. « Payé » enregistre une date ; « non payé » l'efface ($unset)
 * 4. La journalisation (traçabilité) n'a lieu QUE lors d'un vrai changement de statut
 */
describe('PaymentsService (QA)', () => {
  let service: PaymentsService;
  let paymentModel: Record<string, jest.Mock>;
  let playerModel: Record<string, jest.Mock>;
  let playersService: { getAccessiblePlayer: jest.Mock; scopeFilter: jest.Mock };
  let activity: { log: jest.Mock };

  const coach: AuthUser = { userId: new Types.ObjectId().toHexString(), role: Role.Coach };
  const admin: AuthUser = { userId: new Types.ObjectId().toHexString(), role: Role.Admin };
  const playerId = new Types.ObjectId();
  const player = { _id: playerId, name: 'Yassine', monthlyFee: 35 };

  /** Simule les chaînes Mongoose : findOne().select().lean() et findOneAndUpdate().lean() */
  const mockChains = (previous: unknown, saved: unknown) => {
    paymentModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(previous) }),
    });
    paymentModel.findOneAndUpdate.mockReturnValue({ lean: jest.fn().mockResolvedValue(saved) });
  };

  const lastUpdate = () => paymentModel.findOneAndUpdate.mock.calls[0][1] as {
    $set: Record<string, unknown>;
    $unset?: Record<string, unknown>;
  };

  beforeEach(() => {
    paymentModel = { findOne: jest.fn(), findOneAndUpdate: jest.fn(), aggregate: jest.fn() };
    playerModel = { aggregate: jest.fn(), find: jest.fn() };
    playersService = {
      getAccessiblePlayer: jest.fn().mockResolvedValue(player),
      scopeFilter: jest.fn(() => ({})),
    };
    activity = { log: jest.fn() };
    service = new PaymentsService(paymentModel as never, playerModel as never, playersService as unknown as PlayersService, activity as unknown as ActivityService);
  });

  it('enregistre un PAIEMENT PARTIEL : 30 DT reçus sur une cotisation de 35 DT', async () => {
    mockChains(null, { status: 'paid', amount: 30 });

    await service.upsert({ playerId: playerId.toHexString(), month: 10, year: 2026, status: 'paid', amount: 30 }, coach);

    expect(lastUpdate().$set.amount).toBe(30); // pas 35 !
    expect(lastUpdate().$set.status).toBe('paid');
    expect(lastUpdate().$set.paymentDate).toBeInstanceOf(Date);
  });

  it('utilise la cotisation du joueur quand aucun montant n’est fourni', async () => {
    mockChains(null, { status: 'paid', amount: 35 });

    await service.upsert({ playerId: playerId.toHexString(), month: 10, year: 2026, status: 'paid' }, coach);

    expect(lastUpdate().$set.amount).toBe(35); // monthlyFee par défaut
  });

  it('« non payé » efface la date de paiement ($unset)', async () => {
    mockChains({ status: 'paid' }, { status: 'unpaid' });

    await service.upsert({ playerId: playerId.toHexString(), month: 10, year: 2026, status: 'unpaid' }, coach);

    expect(lastUpdate().$unset).toEqual({ paymentDate: 1 });
    expect(lastUpdate().$set).not.toHaveProperty('paymentDate');
  });

  it('journalise un changement de statut (payment.paid)', async () => {
    mockChains(null, { status: 'paid', amount: 35 });

    await service.upsert({ playerId: playerId.toHexString(), month: 10, year: 2026, status: 'paid' }, coach);

    expect(activity.log).toHaveBeenCalledWith(coach, expect.objectContaining({ action: 'payment.paid' }));
  });

  it('NE journalise PAS deux fois le même statut (pas de bruit dans le journal)', async () => {
    // Le mois était DÉJÀ payé → repasser à paid n'est pas un changement
    mockChains({ status: 'paid' }, { status: 'paid', amount: 35 });

    await service.upsert({ playerId: playerId.toHexString(), month: 10, year: 2026, status: 'paid' }, coach);

    expect(activity.log).not.toHaveBeenCalled();
  });

  /**
   * QA — Règle métier « chaque mois est séparé » :
   * un mois futur n'a encore rien de dû → reste à encaisser = 0,
   * sinon l'écran affiche le total complet qui ressemble à une dette du mois précédent.
   */
  describe('getStats (séparation des mois)', () => {
    const mockStatsData = ({ expected = 1385, players = 37, collected = 0, paidCount = 0 } = {}) => {
      playerModel.aggregate.mockResolvedValue([{ expected, players }]);
      playerModel.find.mockReturnValue({ distinct: jest.fn().mockResolvedValue([playerId]) });
      paymentModel.aggregate
        .mockResolvedValueOnce(collected || paidCount ? [{ collected, paidCount }] : [])
        .mockResolvedValueOnce([]); // tendance 6 mois
    };

    it('mois FUTUR : reste à encaisser = 0 même avec une cotisation attendue', async () => {
      mockStatsData({ expected: 1385, players: 37 });
      const next = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth() + 1, 1));

      const stats = await service.getStats(next.getUTCMonth() + 1, next.getUTCFullYear(), admin);

      expect(stats.expected).toBe(1385); // l'attendu reste informatif
      expect(stats.outstanding).toBe(0); // mais rien à encaisser
      expect(stats.unpaidCount).toBe(0);
    });

    it('mois COURANT : reste = attendu − encaissé', async () => {
      mockStatsData({ expected: 1385, players: 37, collected: 335, paidCount: 10 });
      const now = new Date();

      const stats = await service.getStats(now.getMonth() + 1, now.getFullYear(), admin);

      expect(stats.collected).toBe(335);
      expect(stats.outstanding).toBe(1050);
      expect(stats.unpaidCount).toBe(27);
    });
  });
});
