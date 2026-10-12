import { Body, Controller, Delete, Get, Param, Put, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { ParseObjectIdPipe } from '../common/utils/object-id.pipe';
import { SalaryService } from './salary.service';
import { UpsertSalaryDto } from './dto/upsert-salary.dto';

/** Reads an optional integer query param, falling back to `def` when absent/invalid. */
function toInt(value: string | undefined, def: number): number {
  const n = Number(value);
  return Number.isInteger(n) ? n : def;
}

@Controller('salaries')
@Roles(Role.Admin)
export class SalaryController {
  constructor(private readonly salaryService: SalaryService) {}

  /** GET /salaries?month=10&year=2026 — list for a given month (defaults to current). */
  @Get()
  findMonth(@Query('month') month?: string, @Query('year') year?: string) {
    const now = new Date();
    return this.salaryService.getMonth(
      toInt(month, now.getMonth() + 1),
      toInt(year, now.getFullYear()),
    );
  }

  /** GET /salaries/year?year=2026 — list for a full year. */
  @Get('year')
  findYear(@Query('year') year?: string) {
    return this.salaryService.getYear(toInt(year, new Date().getFullYear()));
  }

  /** PUT /salaries — create or update a salary/expense (keyed on id, or name+month+year). */
  @Put()
  upsert(@Body() dto: UpsertSalaryDto, @CurrentUser() user: AuthUser) {
    return this.salaryService.upsert(dto, user);
  }

  /** DELETE /salaries/:id */
  @Delete(':id')
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.salaryService.delete(id);
  }
}
