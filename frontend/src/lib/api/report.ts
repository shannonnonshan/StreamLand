import { authenticatedFetch } from './fetch';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export type ReportTargetType = 'student' | 'teacher';

export async function submitProfileReport(input: {
  reportedId: string;
  targetType: ReportTargetType;
  category: string;
  reason: string;
  description?: string;
  screenshots?: string[];
  metadata?: Record<string, unknown>;
}) {
  return authenticatedFetch(`${API_URL}/admin/reports`, {
    method: 'POST',
    body: JSON.stringify({
      reportedId: input.reportedId,
      targetType: input.targetType,
      category: input.category,
      reason: input.reason,
      description: input.description,
      screenshots: input.screenshots || [],
      metadata: input.metadata,
      type: 'USER',
    }),
  });
}
