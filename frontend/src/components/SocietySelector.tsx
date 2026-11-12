import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMySocieties } from '../hooks/usePoolList';

/** Lets a resident who belongs to several societies switch between them. Hidden when there's one. */
export const SocietySelector: React.FC<{ currentId?: string }> = ({ currentId }) => {
  const navigate = useNavigate();
  const { data: societies } = useMySocieties();

  if (!societies || societies.length < 2) return null;

  return (
    <div className="mb-3">
      <label htmlFor="society-select" className="sr-only">
        Switch society
      </label>
      <select
        id="society-select"
        value={currentId ?? ''}
        onChange={(e) => navigate(`/s/${e.target.value}`)}
        className="w-full bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs font-semibold text-neutral-800"
      >
        {societies.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}, {s.city}
          </option>
        ))}
      </select>
    </div>
  );
};
export default SocietySelector;
