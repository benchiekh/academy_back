import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Query,
} from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { ParseObjectIdPipe } from '../common/utils/object-id.pipe';
import { UpsertPaymentDto } from './dto/upsert-payment.dto';
import { PaymentsService } from './payments.service';

function assertMonth(month: number) {
  if (month < 1 || month > 12) throw new BadRequestException('mois invalide');
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Put()
  @Roles(Role.Admin, Role.Coach)
  upsert(@Body() dto: UpsertPaymentDto, @CurrentUser() user: AuthUser) {
    return this.paymentsService.upsert(dto, user);
  }

  /** GET /payments?month=9&year=2026&category=U13 */
  @Get()
  @Roles(Role.Admin, Role.Coach)
  getMonth(
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
    @CurrentUser() user: AuthUser,
    @Query('category') category?: string,
  ) {
    assertMonth(month);
    return this.paymentsService.getMonth(month, year, user, category);
  }

  /** GET /payments/year?year=2026&category=U13 — players × 12 months grid. */
  @Get('year')
  @Roles(Role.Admin, Role.Coach)
  getYear(
    @Query('year', ParseIntPipe) year: number,
    @CurrentUser() user: AuthUser,
    @Query('category') category?: string,
  ) {
    return this.paymentsService.getYear(year, user, category);
  }

  /** GET /payments/stats?month=9&year=2026 — club finances: admin only. */
  @Get('stats')
  @Roles(Role.Admin)
  getStats(
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
    @CurrentUser() user: AuthUser,
  ) {
    assertMonth(month);
    return this.paymentsService.getStats(month, year, user);
  }

  /** Payment history for one player — also used by parents. */
  @Get('player/:id')
  getPlayerHistory(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.paymentsService.getPlayerHistory(id, user);
  }
}
