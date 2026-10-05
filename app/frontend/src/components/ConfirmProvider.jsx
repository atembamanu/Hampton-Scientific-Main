import { createContext, useCallback, useContext, useRef, useState } from 'react';

import { EditorialDialog } from './admin/EditorialDialog';

const ConfirmContext = createContext(null);

export const ConfirmProvider = ({ children }) => {
  const resolver = useRef(null);
  const [request, setRequest] = useState(null);

  const finish = (value) => {
    const resolve = resolver.current;
    resolver.current = null;
    setRequest(null);
    resolve?.(value);
  };

  const confirm = useCallback((options) => new Promise((resolve) => {
    resolver.current = resolve;
    setRequest({
      label: 'Please confirm',
      title: 'Are you sure?',
      description: '',
      confirmLabel: 'Confirm',
      cancelLabel: 'Cancel',
      tone: 'default',
      ...options,
    });
  }), []);

  const danger = request?.tone === 'danger';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <EditorialDialog
        open={Boolean(request)}
        onClose={() => finish(false)}
        label={request?.label}
        title={request?.title || ''}
        description={request?.description}
      >
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={() => finish(false)}
            className="h-10 px-4 text-sm border border-ink/15 rounded text-ink"
          >
            {request?.cancelLabel || 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => finish(true)}
            className={danger
              ? 'h-10 px-4 text-sm rounded bg-red-600 text-white hover:bg-red-700'
              : 'btn-primary h-10 px-4 text-sm'}
          >
            {request?.confirmLabel || 'Confirm'}
          </button>
        </div>
      </EditorialDialog>
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }
  return confirm;
};
