import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login({ email, password }: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    const payload: JwtPayload = { sub: user.id, role: user.role };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: user.toJSON(),
    };
  }

  async me(userId: string) {
    return (await this.usersService.findById(userId)).toJSON();
  }
}
