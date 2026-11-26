export interface GoalMonthConfig {
  target: number;
  weekdays: number[];
}

export interface GoalsState {
  enabled: boolean;
  goals: Record<string, GoalMonthConfig>;
}

const GOALS_KEY = 'pk_detail_goals_v1';

export const loadGoalsState = (): GoalsState => {
  try {
    const raw = localStorage.getItem(GOALS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object' && parsed.goals) {
      return { enabled: Boolean(parsed.enabled), goals: parsed.goals as Record<string, GoalMonthConfig> };
    }
  } catch {
    // dados corrompidos: trata como metas desativadas
  }
  return { enabled: false, goals: {} };
};

export const countBusinessDaysInMonth = (monthKey: string, weekdays: number[]) => {
  const cursor = new Date(`${monthKey}-01T12:00:00`);
  const month = cursor.getMonth();
  let count = 0;
  while (cursor.getMonth() === month) {
    if (weekdays.includes(cursor.getDay())) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
};

export interface ActiveDailyGoal {
  monthlyTarget: number;
  businessDays: number;
  dailyGoal: number;
}

/**
 * Retorna a meta diária do mês atual apenas quando as metas estão ativas e há meta definida.
 */
export const getActiveDailyGoal = (monthKey: string): ActiveDailyGoal | null => {
  const state = loadGoalsState();
  if (!state.enabled) return null;

  const goal = state.goals[monthKey];
  if (!goal || !Number.isFinite(goal.target) || goal.target <= 0) return null;

  const weekdays = Array.isArray(goal.weekdays) && goal.weekdays.length > 0 ? goal.weekdays : [1, 2, 3, 4, 5, 6];
  const businessDays = countBusinessDaysInMonth(monthKey, weekdays);

  return {
    monthlyTarget: goal.target,
    businessDays,
    dailyGoal: businessDays > 0 ? goal.target / businessDays : goal.target / 30,
  };
};
