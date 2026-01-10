import { useState, useCallback } from 'react';
import { ConfirmDialogType } from '@/component/ConfirmDialog';

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  type: ConfirmDialogType;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    title: '',
    message: '',
    type: 'warning',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: () => {},
  });

  const confirm = useCallback(
    (
      title: string,
      message: string,
      onConfirm: () => void,
      options?: {
        type?: ConfirmDialogType;
        confirmText?: string;
        cancelText?: string;
      }
    ) => {
      setState({
        open: true,
        title,
        message,
        type: options?.type || 'warning',
        confirmText: options?.confirmText || 'Confirm',
        cancelText: options?.cancelText || 'Cancel',
        onConfirm,
      });
    },
    []
  );

  const handleConfirm = useCallback(() => {
    state.onConfirm();
    setState((prev) => ({ ...prev, open: false }));
  }, [state]);

  const handleCancel = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  return {
    confirmState: state,
    confirm,
    handleConfirm,
    handleCancel,
  };
}
