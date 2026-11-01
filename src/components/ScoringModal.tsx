import { useId, useState, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Modal } from './Modal';
import { useFantasyStore } from '../stores/fantasyStore';
import type { ScoringConfig } from '../types';

interface ScoringInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  suffix: string;
}

function ScoringInput({ label, value, onChange, step = 1, suffix }: ScoringInputProps) {
  const id = useId();

  // Kept as text because "" and "-" are valid on the way to typing a number like -1.
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText((current) => (parseFloat(current) === value ? current : String(value)));
  }, [value]);

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <label htmlFor={id} className="text-sm text-gray-700">
        {label}
      </label>
      <div className="flex items-center gap-2 shrink-0">
        <input
          id={id}
          type="number"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const parsed = parseFloat(e.target.value);
            if (Number.isFinite(parsed)) onChange(parsed);
          }}
          onBlur={() => setText(String(value))}
          step={step}
          className="w-16 px-2 py-1.5 text-right text-sm tabular-nums bg-white border border-gray-300 rounded-md
                     [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none
                     focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
        <span className="w-12 text-xs text-gray-400">{suffix}</span>
      </div>
    </div>
  );
}

function ScoringGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-xl border border-gray-200 px-4 py-3">
      <legend className="px-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</legend>
      <div className="divide-y divide-gray-100">{children}</div>
    </fieldset>
  );
}

const RECEPTION_FORMATS = [
  { label: 'PPR', reception: 1 },
  { label: 'Half-PPR', reception: 0.5 },
  { label: 'Standard', reception: 0 },
];

export function ScoringModal() {
  const { isConfigModalOpen, closeConfigModal, scoringConfig, setScoringConfig, resetScoringConfig } =
    useFantasyStore(
      useShallow((state) => ({
        isConfigModalOpen: state.isConfigModalOpen,
        closeConfigModal: state.closeConfigModal,
        scoringConfig: state.scoringConfig,
        setScoringConfig: state.setScoringConfig,
        resetScoringConfig: state.resetScoringConfig,
      }))
    );

  // Local state for form
  const [localConfig, setLocalConfig] = useState<ScoringConfig>(scoringConfig);

  // Sync local state when modal opens
  useEffect(() => {
    if (isConfigModalOpen) {
      setLocalConfig(scoringConfig);
    }
  }, [isConfigModalOpen, scoringConfig]);

  const handleSave = () => {
    setScoringConfig(localConfig);
    closeConfigModal();
  };

  const handleReset = () => {
    resetScoringConfig();
    closeConfigModal();
  };

  const updateConfig = (key: keyof ScoringConfig, value: number) => {
    setLocalConfig((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Modal
      isOpen={isConfigModalOpen}
      onClose={closeConfigModal}
      title="Scoring Settings"
    >
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-medium text-gray-700">Format</span>
          <div className="inline-flex rounded-lg bg-gray-100 p-1">
            {RECEPTION_FORMATS.map(({ label, reception }) => (
              <button
                key={label}
                type="button"
                aria-pressed={localConfig.reception === reception}
                onClick={() => updateConfig('reception', reception)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  localConfig.reception === reception
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ScoringGroup title="Passing">
            <ScoringInput label="Yards per Point" value={localConfig.passingYardsPerPoint} onChange={(v) => updateConfig('passingYardsPerPoint', v)} suffix="yds/pt" />
            <ScoringInput label="Touchdown Points" value={localConfig.passingTD} onChange={(v) => updateConfig('passingTD', v)} suffix="pts" />
            <ScoringInput label="Interception Points" value={localConfig.interception} onChange={(v) => updateConfig('interception', v)} suffix="pts" />
          </ScoringGroup>
          <ScoringGroup title="Rushing">
            <ScoringInput label="Yards per Point" value={localConfig.rushingYardsPerPoint} onChange={(v) => updateConfig('rushingYardsPerPoint', v)} suffix="yds/pt" />
            <ScoringInput label="Touchdown Points" value={localConfig.rushingTD} onChange={(v) => updateConfig('rushingTD', v)} suffix="pts" />
            <ScoringInput label="Points per Carry" value={localConfig.rushingCarry} onChange={(v) => updateConfig('rushingCarry', v)} suffix="pts" step={0.1} />
          </ScoringGroup>
          <ScoringGroup title="Receiving">
            <ScoringInput label="Yards per Point" value={localConfig.receivingYardsPerPoint} onChange={(v) => updateConfig('receivingYardsPerPoint', v)} suffix="yds/pt" />
            <ScoringInput label="Touchdown Points" value={localConfig.receivingTD} onChange={(v) => updateConfig('receivingTD', v)} suffix="pts" />
            <ScoringInput label="Points per Reception" value={localConfig.reception} onChange={(v) => updateConfig('reception', v)} suffix="pts" step={0.5} />
          </ScoringGroup>
          <ScoringGroup title="Fumbles">
            <ScoringInput label="Fumble Lost Points" value={localConfig.fumbleLost} onChange={(v) => updateConfig('fumbleLost', v)} suffix="pts" />
          </ScoringGroup>
        </div>
      </div>

      {/* Actions stay visible while the settings scroll on small screens. */}
      <div className="shrink-0 flex items-center gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50">
        <button
          type="button"
          onClick={handleReset}
          className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
        >
          Reset to Default
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={closeConfigModal}
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
        >
          Save Changes
        </button>
      </div>
    </Modal>
  );
}
