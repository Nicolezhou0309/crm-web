export interface ScoringOption {
  code: string;
  text: string;
  score: number;
}

export interface ScoringDimension {
  id: number;
  dimension_name: string;
  dimension_code: string;
  selection_name: string;
  description: string;
  weight: number;
  sort_order: number;
  is_active: boolean;
  options: ScoringOption[];
}

export interface ScoringData {
  scoring_version: string;
  evaluator_id: number;
  evaluation_date: string;
  dimensions: Record<string, {
    selected_option: string;
    score: number;
    notes?: string;
  }>;
  calculation: {
    total_score: number;
    average_score: number;
    weighted_average: number;
  };
  metadata: {
    created_at: string;
    updated_at: string;
    evaluation_notes?: string;
  };
}

export interface LiveStreamScheduleWithScoring {
  id: number;
  date: string;
  timeSlotId: string;
  participantIds: number[];
  location: string;
  notes?: string;
  status: string;
  createdBy?: number;
  createdAt: string;
  updatedAt: string;
  editingBy?: number | null;
  editingAt?: string | null;
  editingExpiresAt?: string | null;
  lockType: string;
  lockReason?: string | null;
  lockEndTime?: string | null;
  scoring_data?: ScoringData;
  scoring_status?: 'not_scored' | 'scoring_in_progress' | 'scored' | 'approved';
  scored_by?: number | null;
  scored_at?: string | null;
}

export const getScoringScores = (schedule: LiveStreamScheduleWithScoring) => {
  if (!schedule.scoring_data?.calculation) {
    return { total_score: 0, average_score: 0, weighted_average: 0 };
  }
  return schedule.scoring_data.calculation;
}; 