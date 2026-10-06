import { Body, Controller, Get, Put } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleService } from './schedule.service';

@Controller('schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  /** Public: shown on the login page (no account needed) and in the parent space. */
  @Public()
  @Get()
  get() {
    return this.scheduleService.get();
  }

  /** Only the admin publishes the weekly program. */
  @Put()
  @Roles(Role.Admin)
  update(@Body() dto: UpdateScheduleDto, @CurrentUser() user: AuthUser) {
    return this.scheduleService.update(dto.content, user);
  }
}
