import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '../enums/role.enum';

export interface AuthUser {
  userId: string;
  role: Role;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
