import { BadRequestException, Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { isValidObjectId } from 'mongoose';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { ActivityService } from './activity.service';

@Controller('activity')
@Roles(Role.Admin)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  /** GET /activity?actorId=&action=payment&playerId=&from=2026-09-01&to=2026-09-30&page=1 */
  @Get()
  list(
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
    @Query('playerId') playerId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    for (const id of [actorId, playerId]) {
      if (id && !isValidObjectId(id)) throw new BadRequestException(`Identifiant invalide: ${id}`);
    }
    return this.activityService.list({
      actorId,
      action,
      playerId,
      from,
      to,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /** GET /activity/summary?month=9&year=2026 */
  @Get('summary')
  summary(@Query('month', ParseIntPipe) month: number, @Query('year', ParseIntPipe) year: number) {
    if (month < 1 || month > 12) throw new BadRequestException('mois invalide');
    return this.activityService.summary(month, year);
  }
}
