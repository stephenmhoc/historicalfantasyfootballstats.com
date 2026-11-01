import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { ScoringModal } from '../components/ScoringModal';
import { useFantasyStore } from '../stores/fantasyStore';
import { rescoreTable } from './rescoreTable';

/** Adds the homepage scoring settings to the generated pages. */
function start() {
  const button = document.querySelector<HTMLButtonElement>('[data-scoring-open]');
  if (!button) return;

  const table = document.querySelector('table[data-rescorable]') as HTMLTableElement | null;
  const note = document.querySelector<HTMLElement>('[data-scoring-note]');
  const apply = (config: ReturnType<typeof useFantasyStore.getState>['scoringConfig']) => {
    const custom = table ? rescoreTable(table, config) : false;
    if (note) note.hidden = !custom;
  };

  button.hidden = false;
  button.addEventListener('click', () => useFantasyStore.getState().openConfigModal());

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

start();
