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
  suffix?: string;
}

function ScoringInput({ label, value, onChange, step = 1, suffix }: ScoringInputProps) {
  const id = useId();

  // Kept as text because "" and "-" are valid on the way to typing a number like -1.
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText((current) => (parseFloat(current) === value ? current : String(value)));
  }, [value]);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="flex items-center gap-2">
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
          className="w-full px-3 py-2 border border-gray-300 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
        {suffix && <span className="text-sm text-gray-500 whitespace-nowrap">{suffix}</span>}
      </div>
    </div>
  );
}

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
      <div>
        <div className="space-y-6">
          {/* Passing */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
              Passing
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ScoringInput
                label="Yards per Point"
                value={localConfig.passingYardsPerPoint}
                onChange={(v) => updateConfig('passingYardsPerPoint', v)}
                suffix="yds = 1 pt"
              />
              <ScoringInput
                label="Touchdown Points"
                value={localConfig.passingTD}
                onChange={(v) => updateConfig('passingTD', v)}
                suffix="pts"
              />
              <ScoringInput
                label="Interception Points"
                value={localConfig.interception}
                onChange={(v) => updateConfig('interception', v)}
                suffix="pts"
              />
            </div>
          </div>

          {/* Rushing */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
              Rushing
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ScoringInput
                label="Yards per Point"
                value={localConfig.rushingYardsPerPoint}
                onChange={(v) => updateConfig('rushingYardsPerPoint', v)}
                suffix="yds = 1 pt"
              />
              <ScoringInput
                label="Touchdown Points"
                value={localConfig.rushingTD}
                onChange={(v) => updateConfig('rushingTD', v)}
                suffix="pts"
              />
              <ScoringInput
                label="Points per Carry"
                value={localConfig.rushingCarry}
                onChange={(v) => updateConfig('rushingCarry', v)}
                step={0.1}
                suffix="pts (PPC)"
              />
            </div>
          </div>

          {/* Receiving */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
              Receiving
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ScoringInput
                label="Yards per Point"
                value={localConfig.receivingYardsPerPoint}
                onChange={(v) => updateConfig('receivingYardsPerPoint', v)}
                suffix="yds = 1 pt"
              />
              <ScoringInput
                label="Touchdown Points"
                value={localConfig.receivingTD}
                onChange={(v) => updateConfig('receivingTD', v)}
                suffix="pts"
              />
              <ScoringInput
                label="Points per Reception"
                value={localConfig.reception}
                onChange={(v) => updateConfig('reception', v)}
                step={0.5}
                suffix="pts (PPR)"
              />
            </div>
          </div>

          {/* Fumbles */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
              Fumbles
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ScoringInput
                label="Fumble Lost Points"
                value={localConfig.fumbleLost}
                onChange={(v) => updateConfig('fumbleLost', v)}
                suffix="pts"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg
                       hover:bg-gray-200 transition-colors"
          >
            Reset to Default
          </button>
          <div className="flex-1" />
          <button
            onClick={closeConfigModal}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg
                       hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg
                       hover:bg-emerald-700 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </Modal>
  );
}
