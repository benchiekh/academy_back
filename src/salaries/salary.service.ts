import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Salary, SalaryType } from './schemas/salary.schema';
import { UpsertSalaryDto } from './dto/upsert-salary.dto';

type SalaryWithMarker = {
  _id: Types.ObjectId;
  name: string;
  type: SalaryType;
  amount: number;
  month: number;
  year: number;
  markedBy: { name: string } | null;
  updatedAt: Date;
};

@Injectable()
export class SalaryService {
  constructor(
    @InjectModel(Salary.name) private readonly salaryModel: Model<Salary>,
  ) {}

  /** Create or update a salary/expense. Updated by id when provided, otherwise upserted on name+month+year. */
  async upsert(dto: UpsertSalaryDto, user: AuthUser) {
    const update = {
      $set: {
        name: dto.name.trim(),
        type: dto.type,
        amount: dto.amount,
        month: dto.month,
        year: dto.year,
        markedBy: new Types.ObjectId(user.userId),
      },
    };

    const saved = dto.id
      ? await this.salaryModel
          .findByIdAndUpdate(dto.id, update, { new: true, runValidators: true })
          .lean<SalaryWithMarker>()
      : await this.salaryModel
          .findOneAndUpdate(
            { name: dto.name.trim(), month: dto.month, year: dto.year },
            update,
            { upsert: true, new: true, runValidators: true },
          )
          .lean<SalaryWithMarker>();

    return this.toListItem(saved);
  }

  /** All salaries/expenses for a given month. */
  async getMonth(month: number, year: number) {
    const salaries = await this.salaryModel
      .find({ month, year })
      .sort({ type: 1, name: 1 })
      .populate('markedBy', 'name')
      .lean<SalaryWithMarker[]>();

    return salaries.map((s) => this.toListItem(s));
  }

  /** All salaries/expenses for a given year, ordered by month then name. */
  async getYear(year: number) {
    const salaries = await this.salaryModel
      .find({ year })
      .sort({ month: 1, name: 1 })
      .populate('markedBy', 'name')
      .lean<SalaryWithMarker[]>();

    return salaries.map((s) => this.toListItem(s));
  }

  /** Delete a salary/expense record. */
  async delete(id: string) {
    const result = await this.salaryModel.findByIdAndDelete(id).lean();
    return !!result;
  }

  /** Shapes a document for the API (stable `_id`, plain `markedByName`). */
  private toListItem(s: SalaryWithMarker | null) {
    if (!s) return null;
    return {
      _id: s._id,
      name: s.name,
      type: s.type,
      amount: s.amount,
      month: s.month,
      year: s.year,
      markedByName: s.markedBy?.name ?? null,
      updatedAt: s.updatedAt,
    };
  }
}
