import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { ScoringModal } from '../components/ScoringModal';
import { useFantasyStore } from '../stores/fantasyStore';
import type { ScoringConfig } from '../types';
import { rescoreTable } from './rescoreTable';

/** Adds the homepage scoring settings to a generated page. */
function start() {
  const table = document.querySelector('table[data-rescorable]') as HTMLTableElement | null;
  const note = document.querySelector<HTMLElement>('[data-scoring-note]');
  const apply = (config: ScoringConfig) => {
    const custom = table ? rescoreTable(table, config) : false;
    if (note) note.hidden = !custom;
  };

  apply(useFantasyStore.getState().scoringConfig);
  useFantasyStore.subscribe((state, previous) => {
    if (state.scoringConfig !== previous.scoringConfig) apply(state.scoringConfig);
  });

  const root = document.createElement('div');
  document.body.appendChild(root);
  createRoot(root).render(
    <StrictMode>
      <ScoringModal />
    </StrictMode>
  );
}

export const openScoring = () => useFantasyStore.getState().openConfigModal();

start();
