import { useId } from 'react';

interface DropdownOption<T> {
  value: T;
  label: string;
}

interface DropdownProps<T> {
  label: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
}

export function Dropdown<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: DropdownProps<T>) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </label>
      <select
        id={id}
        value={String(value)}
        onChange={(e) => {
          const selected = options.find((o) => String(o.value) === e.target.value);
          if (selected) onChange(selected.value);
        }}
        className="px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm
                   text-sm font-medium text-gray-700
                   focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                   cursor-pointer"
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
