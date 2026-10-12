import { Types } from 'mongoose';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { ScheduleService } from './schedule.service';

/**
 * QA — Programme des séances (document unique).
 *
 * Comportements testés :
 * 1. Premier accès : un document vide est créé automatiquement (pas de crash)
 * 2. La mise à jour remplace le contenu et enregistre l'auteur (traçabilité)
 */
describe('ScheduleService (QA)', () => {
  let service: ScheduleService;
  let scheduleModel: Record<string, jest.Mock>;

  const admin: AuthUser = { userId: new Types.ObjectId().toHexString(), role: Role.Admin };

  beforeEach(() => {
    scheduleModel = { findOne: jest.fn(), create: jest.fn(), findOneAndUpdate: jest.fn() };
    service = new ScheduleService(scheduleModel as never);
  });

  it('retourne le document existant', async () => {
    scheduleModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ content: 'Samedi 16h' }) });

    const res = await service.get();

    expect(res.content).toBe('Samedi 16h');
    expect(scheduleModel.create).not.toHaveBeenCalled();
  });

  it('crée un document vide au premier accès (upsert implicite)', async () => {
    scheduleModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    scheduleModel.create.mockResolvedValue({ content: '' });

    const res = await service.get();

    expect(scheduleModel.create).toHaveBeenCalledWith({ content: '' });
    expect(res.content).toBe('');
  });

  it('met à jour le contenu avec l’auteur de la modification', async () => {
    scheduleModel.findOneAndUpdate.mockReturnValue({ lean: jest.fn().mockResolvedValue({ content: 'Dimanche 10h' }) });

    await service.update('Dimanche 10h', admin);

    const [, update, options] = scheduleModel.findOneAndUpdate.mock.calls[0] as [
      unknown,
      { $set: Record<string, unknown> },
      Record<string, unknown>,
    ];
    expect(update.$set.content).toBe('Dimanche 10h');
    expect(update.$set.updatedBy).toEqual(new Types.ObjectId(admin.userId));
    expect(options).toMatchObject({ upsert: true, new: true });
  });
});
