import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminUpdateCutoff } from '../../api/adminApi';
import { getErrorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';
import { toDatetimeLocal } from '../../lib/time';
import { validateCutoff } from '../../lib/validation';
import type { PoolProgress } from '../../types';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface EditCutoffDialogProps {
  /** The deal being edited; null keeps the dialog closed. */
  pool: PoolProgress | null;
  onClose: () => void;
}

/** Lets an admin move the closing time of an open deal (earlier or later, within the allowed window). */
export const EditCutoffDialog: React.FC<EditCutoffDialogProps> = ({ pool, onClose }) => {
  // The inner form remounts for each deal so its fields always start from that deal's current time.
  return pool ? <Inner key={pool.poolWindowId} pool={pool} onClose={onClose} /> : null;
};

const Inner: React.FC<{ pool: PoolProgress; onClose: () => void }> = ({ pool, onClose }) => {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(() => toDatetimeLocal(pool.cutoffAt));
  const [localError, setLocalError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (iso: string) => adminUpdateCutoff(pool.poolWindowId, iso),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'pools'] });
      void queryClient.invalidateQueries({ queryKey: ['pools'] });
      onClose();
    },
  });

  const confirm = () => {
    const error = validateCutoff(value);
    if (error) {
      setLocalError(error);
      return;
    }
    setLocalError(null);
    mutation.mutate(new Date(value).toISOString());
  };

  const serverError = mutation.isError ? getErrorMessage(mutation.error, 'Could not change the closing time. Please try again.') : null;

  return (
    <ConfirmDialog
      open
      title="Change closing time"
      confirmLabel="Save new time"
      pendingLabel="Saving…"
      pending={mutation.isPending}
      error={localError ?? serverError}
      onCancel={onClose}
      onConfirm={confirm}
    >
      <p className="mb-3">
        <strong className="text-neutral-900">{pool.productName}</strong> now closes {formatDateTime(pool.cutoffAt, true)}.
        Residents see the new time straight away. Their prices can only get better as more neighbours join.
      </p>
      <label htmlFor="new-cutoff" className="block text-xs font-semibold text-neutral-800 mb-1">New closing time</label>
      <input
        id="new-cutoff"
        type="datetime-local"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setLocalError(null);
          mutation.reset();
        }}
        className="w-full px-3.5 py-2 text-xs font-semibold text-neutral-900 border border-neutral-300 rounded-xl"
      />
    </ConfirmDialog>
  );
};
export default EditCutoffDialog;
