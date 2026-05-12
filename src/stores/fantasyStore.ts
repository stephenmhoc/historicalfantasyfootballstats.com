import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PositionFilter, YearFilter, ScoringConfig } from '../types';
import { DEFAULT_SCORING } from '../utils/constants';

interface FantasyStore {
  // Filters
  positionFilter: PositionFilter;
  yearFilter: YearFilter;

  // Scoring configuration
  scoringConfig: ScoringConfig;

  // Modal state
  isConfigModalOpen: boolean;

  // Actions
  setPositionFilter: (position: PositionFilter) => void;
  setYearFilter: (year: YearFilter) => void;
  setScoringConfig: (config: Partial<ScoringConfig>) => void;
  resetScoringConfig: () => void;
  openConfigModal: () => void;
  closeConfigModal: () => void;
}

export const useFantasyStore = create<FantasyStore>()(
  persist(
    (set) => ({
      positionFilter: 'All',
      yearFilter: 'Last36',
      scoringConfig: DEFAULT_SCORING,
      isConfigModalOpen: false,

      setPositionFilter: (position) => set({ positionFilter: position }),
      setYearFilter: (year) => set({ yearFilter: year }),
      setScoringConfig: (config) =>
        set((state) => ({
          scoringConfig: { ...state.scoringConfig, ...config },
        })),
      resetScoringConfig: () => set({ scoringConfig: DEFAULT_SCORING }),
      openConfigModal: () => set({ isConfigModalOpen: true }),
      closeConfigModal: () => set({ isConfigModalOpen: false }),
    }),
    {
      name: 'fantasy-mvp-storage',
      partialize: (state) => ({
        scoringConfig: state.scoringConfig,
        positionFilter: state.positionFilter,
        yearFilter: state.yearFilter,
      }),
    }
  )
);
