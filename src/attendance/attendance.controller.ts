import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { ParseObjectIdPipe } from '../common/utils/object-id.pipe';
import { AttendanceService } from './attendance.service';
import { BulkAttendanceDto } from './dto/bulk-attendance.dto';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('bulk')
  @Roles(Role.Admin, Role.Coach)
  bulkMark(@Body() dto: BulkAttendanceDto, @CurrentUser() user: AuthUser) {
    return this.attendanceService.bulkMark(dto, user);
  }

  /** GET /attendance?date=2026-09-28&category=U13 */
  @Get()
  @Roles(Role.Admin, Role.Coach)
  getDay(
    @CurrentUser() user: AuthUser,
    @Query('date') date: string,
    @Query('category') category?: string,
  ) {
    if (!date || isNaN(Date.parse(date))) throw new BadRequestException('date invalide');
    return this.attendanceService.getDay(date, user, category);
  }

  /** GET /attendance/player/:id?month=9&year=2026 — also used by parents. */
  @Get('player/:id')
  getPlayerMonth(
    @Param('id', ParseObjectIdPipe) id: string,
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
    @CurrentUser() user: AuthUser,
  ) {
    if (month < 1 || month > 12) throw new BadRequestException('mois invalide');
    return this.attendanceService.getPlayerMonth(id, month, year, user);
  }
}
