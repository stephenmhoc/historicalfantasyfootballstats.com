import { useState, useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { PlayerSeason, PlayerSeasonWithPoints } from '../types';
import { useFantasyStore } from '../stores/fantasyStore';
import { calculateFantasyPoints } from '../utils/calculations';
import { filterByPosition, filterByYearRange } from '../utils/filters';
import { MAX_RESULTS } from '../utils/constants';

export function useFantasyData() {
  const [rawData, setRawData] = useState<PlayerSeason[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Load data on mount
  useEffect(() => {
    fetch('/data/fantasy_data.json')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load data');
        return res.json();
      })
      .then((data: PlayerSeason[]) => {
        setRawData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

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
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [weeklyYear, weeklyData]);

  const weeklyLoading = weeklyYear !== null && weeklyData?.year !== weeklyYear;

  // Calculate filtered and scored data
  const data = useMemo<PlayerSeasonWithPoints[]>(() => {
    if (loading || weeklyLoading || !rawData.length) return [];

    // Apply filters
    const showWeek = weeklyYear !== null;
    const source = showWeek ? (weeklyData?.rows ?? []).filter((row) => row.week === weekFilter) : rawData;
    let filtered = filterByPosition(source, positionFilter);
    filtered = filterByYearRange(filtered, yearFilter);

    // Calculate fantasy points for each player
    const withPoints = filtered.map((player) => ({
      ...player,
      fantasyPoints: calculateFantasyPoints(player, scoringConfig),
      rank: 0, // Placeholder, will be set after sorting
    }));

    // Sort by fantasy points descending
    withPoints.sort((a, b) => b.fantasyPoints - a.fantasyPoints);

    // Limit to top N results and assign ranks
    const topResults = withPoints.slice(0, MAX_RESULTS);
    topResults.forEach((player, index) => {
      player.rank = index + 1;
    });

    return topResults;
  }, [rawData, weeklyData, weeklyYear, weeklyLoading, loading, positionFilter, yearFilter, weekFilter, scoringConfig]);

  return { data, loading: loading || weeklyLoading, error };
}
