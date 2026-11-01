import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PositionFilter, WeekFilter, YearFilter, ScoringConfig } from '../types';
import { DEFAULT_SCORING } from '../utils/constants';
import { STORAGE_KEY } from './storageKey';

interface FantasyStore {
  // Filters
  positionFilter: PositionFilter;
  yearFilter: YearFilter;
  weekFilter: WeekFilter;

  // Scoring configuration
  scoringConfig: ScoringConfig;

  // Modal state
  isConfigModalOpen: boolean;

  // Actions
  setPositionFilter: (position: PositionFilter) => void;
  setYearFilter: (year: YearFilter) => void;
  setWeekFilter: (week: WeekFilter) => void;
  setScoringConfig: (config: Partial<ScoringConfig>) => void;
  resetScoringConfig: () => void;
  openConfigModal: () => void;
  closeConfigModal: () => void;
}

type PersistedState = Pick<FantasyStore, 'scoringConfig' | 'positionFilter' | 'yearFilter'>;

// Year filters whose IDs used to embed a year count that went stale every season.
const RENAMED_YEAR_FILTERS: Record<string, YearFilter> = {
  Last56: 'AllYears',
  Last55: 'AllYears',
  Last35: 'Last36',
};

export const useFantasyStore = create<FantasyStore>()(
  persist(
    (set) => ({
      positionFilter: 'All',
      yearFilter: 'Last36',
      weekFilter: 'Season',
      scoringConfig: DEFAULT_SCORING,
      isConfigModalOpen: false,

      setPositionFilter: (position) => set({ positionFilter: position }),
      setYearFilter: (year) => set({ yearFilter: year, weekFilter: 'Season' }),
      setWeekFilter: (week) => set({ weekFilter: week }),
      setScoringConfig: (config) =>
        set((state) => ({
          scoringConfig: { ...state.scoringConfig, ...config },
        })),
      resetScoringConfig: () => set({ scoringConfig: DEFAULT_SCORING }),
      openConfigModal: () => set({ isConfigModalOpen: true }),
      closeConfigModal: () => set({ isConfigModalOpen: false }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      migrate: (persisted) => {
        const state = persisted as PersistedState;
        return { ...state, yearFilter: RENAMED_YEAR_FILTERS[String(state.yearFilter)] ?? state.yearFilter };
      },
      // Scoring is merged so that a field added later gets its default for existing users.
      merge: (persisted, current) => {
        const state = persisted as Partial<PersistedState> | undefined;
        return {
          ...current,
          ...state,
          scoringConfig: { ...DEFAULT_SCORING, ...state?.scoringConfig },
        };
      },
      partialize: (state) => ({
        scoringConfig: state.scoringConfig,
        positionFilter: state.positionFilter,
        yearFilter: state.yearFilter,
      }),
    }
  )
);
