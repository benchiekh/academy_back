import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Role } from '../src/common/enums/role.enum';
import { Player } from '../src/players/schemas/player.schema';
import { User } from '../src/users/schemas/user.schema';

/**
 * QA — Tests END-TO-END de l'API complète.
 *
 * Différence avec les tests unitaires : ici on démarre TOUTE l'application
 * (vrais contrôleurs, vrais guards JWT/rôles, vrai ValidationPipe, vrai
 * rate-limiter) contre une VRAIE base MongoDB éphémère en mémoire
 * (mongodb-memory-server — aucune donnée réelle n'est touchée).
 *
 * Parcours critiques couverts :
 * - endpoints publics vs protégés (401/403)
 * - flux RBAC parent : ses enfants oui, ceux des autres non
 * - filtrage des champs sensibles côté serveur
 * - finances réservées à l'admin
 * - rate limiting anti brute-force sur /auth/login
 */
describe('API e2e (QA)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let adminToken: string;
  let coachToken: string;
  let parentToken: string;
  let ownChildId: string;
  let otherChildId: string;

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    // 1) Base MongoDB éphémère en mémoire (télécharge mongod au 1er run)
    mongod = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongod.getUri();
    process.env.JWT_SECRET = 'e2e-test-secret-key';
    process.env.CORS_ORIGIN = 'http://localhost:5173';

    // 2) Application configurée EXACTEMENT comme main.ts
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    // 3) Jeu de données : 4 comptes + 2 enfants de parents différents
    const userModel = moduleRef.get<Model<User>>(getModelToken(User.name));
    const playerModel = moduleRef.get<Model<Player>>(getModelToken(Player.name));
    const hash = (pw: string) => bcrypt.hash(pw, 10);

    await userModel.create({ name: 'Admin', email: 'admin@test.com', role: Role.Admin, password: await hash('Admin123!') });
    await userModel.create({ name: 'Coach', email: 'coach@test.com', role: Role.Coach, password: await hash('Coach123!') });
    const parent = await userModel.create({ name: 'Parent', email: 'parent@test.com', role: Role.Parent, password: await hash('Parent123!') });
    const other = await userModel.create({ name: 'Autre Parent', email: 'autre@test.com', role: Role.Parent, password: await hash('Parent123!') });

    const own = await playerModel.create({ name: 'Mon Enfant', dateOfBirth: '2013-01-01', category: 'U13', monthlyFee: 35, parentId: parent._id });
    const stranger = await playerModel.create({ name: 'Autre Enfant', dateOfBirth: '2012-01-01', category: 'U15', monthlyFee: 40, parentId: other._id });
    ownChildId = own._id.toHexString();
    otherChildId = stranger._id.toHexString();

    const login = async (email: string, password: string) =>
      (await http().post('/api/auth/login').send({ email, password })).body.accessToken as string;
    adminToken = await login('admin@test.com', 'Admin123!');
    coachToken = await login('coach@test.com', 'Coach123!');
    parentToken = await login('parent@test.com', 'Parent123!');
  });

  afterAll(async () => {
    await app?.close();
    await mongod?.stop();
  });

  // ---------- Accès public vs protégé ----------

  it('GET /schedule est PUBLIC (la page login n’a pas de compte)', async () => {
    const res = await http().get('/api/schedule');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('content');
  });

  it('GET /players SANS token → 401', async () => {
    const res = await http().get('/api/players');
    expect(res.status).toBe(401);
  });

  it('ValidationPipe : un champ inconnu dans le body → 400', async () => {
    const res = await http().post('/api/auth/login').send({ email: 'admin@test.com', password: 'Admin123!', hack: true });
    expect(res.status).toBe(400);
  });

  it('login : mauvais mot de passe → 401 (même message qu’email inconnu)', async () => {
    const res = await http().post('/api/auth/login').send({ email: 'admin@test.com', password: 'faux' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Email ou mot de passe incorrect');
  });

  // ---------- RBAC parent ----------

  it('un parent ne peut PAS lister tous les joueurs → 403', async () => {
    const res = await http().get('/api/players').set(auth(parentToken));
    expect(res.status).toBe(403);
  });

  it('GET /players/mine ne retourne QUE les enfants du parent', async () => {
    const res = await http().get('/api/players/mine').set(auth(parentToken));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Mon Enfant');
  });

  it('un parent peut remplir la fiche de SON enfant mais SANS le champ notes', async () => {
    const res = await http()
      .put(`/api/players/${ownChildId}/technical-sheet`)
      .set(auth(parentToken))
      .send({ height: 150, strongHand: 'right', notes: 'tentative parent' });
    expect(res.status).toBe(200);
    expect(res.body.height).toBe(150);
    expect(res.body.notes).toBeUndefined(); // notes réservé au staff
  });

  it('un parent NE PEUT PAS toucher la fiche de l’enfant d’un autre → 403', async () => {
    const res = await http()
      .put(`/api/players/${otherChildId}/technical-sheet`)
      .set(auth(parentToken))
      .send({ height: 160 });
    expect(res.status).toBe(403);
  });

  it('PATCH joueur par un parent : category/monthlyFee ignorés, nom appliqué', async () => {
    const res = await http()
      .patch(`/api/players/${ownChildId}`)
      .set(auth(parentToken))
      .send({ name: 'Nom Corrigé', category: 'U19', monthlyFee: 1 });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Nom Corrigé');
    expect(res.body.category).toBe('U13'); // inchangé
    expect(res.body.monthlyFee).toBe(35); // inchangé
  });

  // ---------- Finances réservées à l'admin ----------

  it('GET /payments/stats : coach → 403, admin → 200', async () => {
    const asCoach = await http().get('/api/payments/stats?month=10&year=2026').set(auth(coachToken));
    expect(asCoach.status).toBe(403);

    const asAdmin = await http().get('/api/payments/stats?month=10&year=2026').set(auth(adminToken));
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body).toHaveProperty('collected');
  });

  it('un coach PEUT marquer un paiement partiel (30 DT sur 35 DT)', async () => {
    const res = await http()
      .put('/api/payments')
      .set(auth(coachToken))
      .send({ playerId: ownChildId, month: 10, year: 2026, status: 'paid', amount: 30 });
    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(30);
  });

  // ---------- Programme des séances ----------

  it('PUT /schedule : parent → 403, admin → 200 puis visible publiquement', async () => {
    const asParent = await http().put('/api/schedule').set(auth(parentToken)).send({ content: 'hack' });
    expect(asParent.status).toBe(403);

    const asAdmin = await http().put('/api/schedule').set(auth(adminToken)).send({ content: 'Samedi 16h — U13' });
    expect(asAdmin.status).toBe(200);

    const pub = await http().get('/api/schedule');
    expect(pub.body.content).toBe('Samedi 16h — U13');
  });

  // ---------- Rate limiting (dernier test : il épuise le quota login) ----------

  it('brute-force : après 5 tentatives de login / minute → 429 Too Many Requests', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) {
      const res = await http().post('/api/auth/login').send({ email: 'admin@test.com', password: 'faux' });
      statuses.push(res.status);
    }
    expect(statuses).toContain(429);
  });
});
