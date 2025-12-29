"use client";

import { useState, useCallback } from "react";
import ConfirmDialog, { ConfirmDialogType } from "@/component/ConfirmDialog";

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
    title: "",
    message: "",
    type: "warning",
    confirmText: "Confirm",
    cancelText: "Cancel",
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
        type: options?.type || "warning",
        confirmText: options?.confirmText || "Confirm",
        cancelText: options?.cancelText || "Cancel",
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

  const ConfirmComponent = state.open ? (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      message={state.message}
      type={state.type}
      confirmText={state.confirmText}
      cancelText={state.cancelText}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return {
    confirm,
    ConfirmComponent,
  };
}
