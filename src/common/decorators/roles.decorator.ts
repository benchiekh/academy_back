import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums/role.enum';

export const ROLES_KEY = 'roles';

/** Restricts a route to the given roles. `@Roles('admin', 'coach')` or `@Roles(Role.Admin)`. */
export const Roles = (...roles: (Role | `${Role}`)[]) => SetMetadata(ROLES_KEY, roles);
