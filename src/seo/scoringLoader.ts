import { STORAGE_KEY } from '../stores/storageKey';

/**
 * Keeps generated pages free of React until it is needed: when the visitor
 * opens the scoring settings, or arrives with saved settings to apply.
 */
function hasSavedScoring() {
  try {
    return Boolean(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').state?.scoringConfig);
  } catch {
    return false;
  }
}

const loadWidget = () => import('./scoringWidget');

document.querySelector('[data-scoring-open]')?.addEventListener('click', () => {
  loadWidget().then(({ openScoring }) => openScoring());
});

if (hasSavedScoring()) void loadWidget();
