import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

/**
 * QA — Authentification.
 *
 * Pourquoi ces tests ? Le login est la porte d'entrée de l'application.
 * Un attaquant tente de deviner des couples email/mot de passe.
 * Règle de sécurité testée : le message d'erreur doit être IDENTIQUE
 * que l'email existe ou non — sinon on peut « énumérer » les comptes.
 *
 * Technique : on « mock » (simule) UsersService et JwtService pour tester
 * uniquement la logique de AuthService, sans base de données.
 */
describe('AuthService (QA)', () => {
  let service: AuthService;
  let usersService: { findByEmailWithPassword: jest.Mock; findById: jest.Mock };
  let jwtService: { signAsync: jest.Mock };

  // bcrypt avec 4 rounds seulement → les tests restent rapides
  const hash = (pw: string) => bcrypt.hash(pw, 4);

  beforeEach(() => {
    usersService = { findByEmailWithPassword: jest.fn(), findById: jest.fn() };
    jwtService = { signAsync: jest.fn().mockResolvedValue('fake-jwt-token') };
    service = new AuthService(usersService as unknown as UsersService, jwtService as unknown as JwtService);
  });

  it('retourne un token JWT + le profil quand les identifiants sont corrects', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue({
      id: 'u1',
      role: 'admin',
      password: await hash('MonMotDePasse1'),
      toJSON: () => ({ id: 'u1', email: 'a@a.com', role: 'admin' }),
    });

    const res = await service.login({ email: 'a@a.com', password: 'MonMotDePasse1' });

    expect(res.accessToken).toBe('fake-jwt-token');
    expect(res.user.email).toBe('a@a.com');
    // Le payload JWT doit contenir l'id et le rôle (utilisés par les guards)
    expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: 'u1', role: 'admin' });
  });

  it('rejette un mot de passe incorrect (401)', async () => {
    usersService.findByEmailWithPassword.mockResolvedValue({
      id: 'u1',
      role: 'parent',
      password: await hash('BonMotDePasse'),
      toJSON: () => ({}),
    });

    await expect(service.login({ email: 'a@a.com', password: 'mauvais' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejette un email inconnu avec LE MÊME message qu’un mot de passe faux (anti-énumération)', async () => {
    // Cas 1 : email qui n'existe pas
    usersService.findByEmailWithPassword.mockResolvedValue(null);
    const errEmail = await service.login({ email: 'inconnu@a.com', password: 'x' }).catch((e) => e);

    // Cas 2 : email connu + mauvais mot de passe
    usersService.findByEmailWithPassword.mockResolvedValue({
      id: 'u1',
      role: 'parent',
      password: await hash('BonMotDePasse'),
      toJSON: () => ({}),
    });
    const errPass = await service.login({ email: 'a@a.com', password: 'mauvais' }).catch((e) => e);

    expect(errEmail).toBeInstanceOf(UnauthorizedException);
    expect(errPass).toBeInstanceOf(UnauthorizedException);
    // Un attaquant ne doit pas pouvoir distinguer les deux situations
    expect(errEmail.message).toBe(errPass.message);
  });
});
