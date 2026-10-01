import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsMongoId,
  ValidateNested,
} from 'class-validator';
import { ATTENDANCE_STATUSES, AttendanceStatus } from '../schemas/attendance.schema';

export class AttendanceRecordDto {
  @IsMongoId()
  playerId: string;

  @IsIn(ATTENDANCE_STATUSES)
  status: AttendanceStatus;
}

export class BulkAttendanceDto {
  /** YYYY-MM-DD */
  @IsDateString()
  date: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecordDto)
  records: AttendanceRecordDto[];
}
