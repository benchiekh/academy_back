import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { ParseObjectIdPipe } from '../common/utils/object-id.pipe';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@Roles(Role.Admin, Role.Coach)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    return this.usersService.create(dto, user);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query('role') role?: Role) {
    return this.usersService.findAll(user, role);
  }

  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.usersService.remove(id, user);
  }
}
