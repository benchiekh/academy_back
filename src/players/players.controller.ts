import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { ParseObjectIdPipe } from '../common/utils/object-id.pipe';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { UpsertTechnicalSheetDto } from './dto/upsert-technical-sheet.dto';
import { PlayersService } from './players.service';

@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get()
  @Roles(Role.Admin, Role.Coach)
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('category') category?: string,
    @Query('active', new ParseBoolPipe({ optional: true })) active?: boolean,
  ) {
    return this.playersService.findAll(user, { category, active });
  }

  /** Parent: my children (with technical sheet + age). Declared before ':id'. */
  @Get('mine')
  @Roles(Role.Parent)
  findMine(@CurrentUser() user: AuthUser) {
    return this.playersService.findMine(user);
  }

  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.playersService.findOne(id, user);
  }

  @Post()
  @Roles(Role.Admin, Role.Coach)
  create(@Body() dto: CreatePlayerDto, @CurrentUser() user: AuthUser) {
    return this.playersService.create(dto, user);
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Coach)
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdatePlayerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.playersService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.Admin, Role.Coach)
  remove(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.playersService.remove(id, user);
  }

  // ---- Fiche technique ----

  @Get(':id/technical-sheet')
  getTechnicalSheet(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.playersService.getTechnicalSheet(id, user);
  }

  @Put(':id/technical-sheet')
  @Roles(Role.Admin, Role.Coach)
  upsertTechnicalSheet(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpsertTechnicalSheetDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.playersService.upsertTechnicalSheet(id, dto, user);
  }
}
