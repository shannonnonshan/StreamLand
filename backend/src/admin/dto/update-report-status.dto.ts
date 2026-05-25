import { IsIn, IsOptional, IsString } from 'class-validator';

const REPORT_STATUSES = ['RESOLVED', 'DISMISSED'] as const;

export type UpdatableReportStatus = (typeof REPORT_STATUSES)[number];

export class UpdateReportStatusDto {
  @IsIn(REPORT_STATUSES)
  declare status: UpdatableReportStatus;

  @IsOptional()
  @IsString()
  resolution?: string;
}
