import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

export type PartSortField = 'name' | 'part_no' | 'stock' | 'rack' | 'category';

interface SortableThProps {
  label: string;
  field: PartSortField;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (field: PartSortField, dir: 'asc' | 'desc') => void;
}

export function SortableTh({ label, field, sortBy, sortDir, onSort }: SortableThProps) {
  const active = sortBy === field;
  return (
    <th className="p-4">
      <button
        onClick={() => onSort(field, active && sortDir === 'asc' ? 'desc' : 'asc')}
        className="flex items-center gap-1 hover:text-blue-600 uppercase text-xs font-semibold"
      >
        {label}
        {active ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
      </button>
    </th>
  );
}
