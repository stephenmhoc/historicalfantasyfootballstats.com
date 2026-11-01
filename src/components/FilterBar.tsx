import { useShallow } from 'zustand/react/shallow';
import { Dropdown } from './Dropdown';
import { useFantasyStore } from '../stores/fantasyStore';
import { POSITIONS, YEAR_FILTERS, INDIVIDUAL_YEARS, getWeeksForYear } from '../utils/constants';
import type { PositionFilter, WeekFilter, YearFilter } from '../types';

export function FilterBar() {
  const {
    positionFilter,
    yearFilter,
    weekFilter,
    setPositionFilter,
    setYearFilter,
    setWeekFilter,
    openConfigModal,
  } = useFantasyStore(
    useShallow((state) => ({
      positionFilter: state.positionFilter,
      yearFilter: state.yearFilter,
      weekFilter: state.weekFilter,
      setPositionFilter: state.setPositionFilter,
      setYearFilter: state.setYearFilter,
      setWeekFilter: state.setWeekFilter,
      openConfigModal: state.openConfigModal,
    }))
  );

  const positionOptions = POSITIONS.map((p) => ({
    value: p,
    label: p === 'All' ? 'All Positions' : p,
  }));

  const yearOptions = [
    ...YEAR_FILTERS,
    ...INDIVIDUAL_YEARS,
  ];

  const weeks = getWeeksForYear(yearFilter);
  const weekOptions: { value: WeekFilter; label: string }[] = [
    { value: 'Season', label: 'Full Season' },
    ...weeks.map(({ week, gamesPlayed, gamesScheduled }) => ({
      value: week,
      label:
        gamesScheduled && gamesPlayed < gamesScheduled
          ? `Week ${week} (${gamesPlayed} of ${gamesScheduled} games)`
          : `Week ${week}`,
    })),
  ];

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-end">
        <Dropdown<PositionFilter>
          label="Position"
          value={positionFilter}
          options={positionOptions}
          onChange={setPositionFilter}
        />

        <Dropdown<YearFilter>
          label="Year"
          value={yearFilter}
          options={yearOptions}
          onChange={setYearFilter}
        />

        {weeks.length > 0 && (
          <Dropdown<WeekFilter>
            label="Week"
            value={weekFilter}
            options={weekOptions}
            onChange={setWeekFilter}
          />
        )}

        <div className="flex-1" />

        <button
          onClick={openConfigModal}
          className="px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg
                     hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Scoring Settings
        </button>
      </div>
    </div>
  );
}
