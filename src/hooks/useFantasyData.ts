import { useState, useEffect, useMemo, useRef } from 'react';
import { captureException } from '@sentry/react';
import { useShallow } from 'zustand/react/shallow';
import type { PlayerSeason, PlayerSeasonWithPoints } from '../types';
import { useFantasyStore } from '../stores/fantasyStore';
import { DEFAULT_POSITION, DEFAULT_YEAR } from '../utils/constants';
import { computeView, isDefaultScoring } from '../utils/view';

/** The default view, which the build puts in the homepage HTML. */
function readPrebuiltRows(): PlayerSeason[] | null {
  const script = document.getElementById('default-view');
  if (!script?.textContent) return null;

  try {
    return JSON.parse(script.textContent);
  } catch (error) {
    captureException(error, { tags: { data_file: 'default-view' } });
    return null;
  }
}

/** Reports a failed data load. A failed fetch is a TypeError: the visitor's network, not the site. */
function reportLoadError(error: unknown, file: string) {
  if (!(error instanceof TypeError)) captureException(error, { tags: { data_file: file } });
}

const prebuiltRows = readPrebuiltRows();

/** Runs a task once the browser is idle, and returns a function that cancels it. */
function whenIdle(task: () => void) {
  if ('requestIdleCallback' in window) {
    const handle = requestIdleCallback(task, { timeout: 5000 });
    return () => cancelIdleCallback(handle);
  }
  const handle = setTimeout(task, 2000);
  return () => clearTimeout(handle);
}

export function useFantasyData() {
  const [allRows, setAllRows] = useState<PlayerSeason[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(false);

  const [weeklyData, setWeeklyData] = useState<{ year: number; rows: PlayerSeason[] } | null>(null);

  const { positionFilter, yearFilter, weekFilter, scoringConfig } = useFantasyStore(
    useShallow((state) => ({
      positionFilter: state.positionFilter,
      yearFilter: state.yearFilter,
      weekFilter: state.weekFilter,
      scoringConfig: state.scoringConfig,
    }))
  );
  const weeklyYear = typeof weekFilter === 'number' && typeof yearFilter === 'number' ? yearFilter : null;

  // Only this exact view can use the prebuilt rows, so saved settings or a new
  // filter never show a ranking built for different ones.
  const canUsePrebuilt =
    prebuiltRows !== null &&
    positionFilter === DEFAULT_POSITION &&
    yearFilter === DEFAULT_YEAR &&
    weekFilter === 'Season' &&
    isDefaultScoring(scoringConfig);

  // The full data loads while idle, or at once when the current view needs it.
  useEffect(() => {
    if (allRows || requested.current) return;

    const load = () => {
      requested.current = true;
      setError(null);
      fetch('/data/fantasy_data.json')
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load data');
          return res.json();
        })
        .then((rows: PlayerSeason[]) => setAllRows(rows))
        .catch((err) => {
          requested.current = false;
          reportLoadError(err, 'fantasy_data.json');
          setError(err.message);
        });
    };

    if (!canUsePrebuilt) {
      load();
      return;
    }
    return whenIdle(load);
  }, [allRows, canUsePrebuilt]);

  // Weekly data is only needed when a week is selected, so it loads on demand
  useEffect(() => {
    if (weeklyYear === null || weeklyData?.year === weeklyYear) return;

    let cancelled = false;
    fetch(`/data/weekly/${weeklyYear}.json`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load weekly data');
        return res.json();
      })
      .then((rows: PlayerSeason[]) => {
        if (!cancelled) setWeeklyData({ year: weeklyYear, rows });
      })
      .catch((err) => {
        reportLoadError(err, `weekly/${weeklyYear}.json`);
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [weeklyYear, weeklyData]);

  const weeklyLoading = weeklyYear !== null && weeklyData?.year !== weeklyYear;

  const rows = allRows ?? (canUsePrebuilt ? prebuiltRows : null);

  const data = useMemo<PlayerSeasonWithPoints[]>(() => {
    if (!rows || weeklyLoading) return [];

    const source = weeklyYear !== null ? (weeklyData?.rows ?? []).filter((row) => row.week === weekFilter) : rows;
    return computeView(source, { position: positionFilter, year: yearFilter, scoring: scoringConfig });
  }, [rows, weeklyData, weeklyYear, weeklyLoading, positionFilter, yearFilter, weekFilter, scoringConfig]);

  // A failed background load stays quiet while the prebuilt rows are on screen.
  const visibleError = rows === null || weeklyYear !== null ? error : null;

  return { data, loading: (rows === null && !visibleError) || weeklyLoading, error: visibleError };
}
