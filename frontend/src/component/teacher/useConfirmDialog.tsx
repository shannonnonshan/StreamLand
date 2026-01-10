"use client";

import { useState } from "react";
import ConfirmDialog, { ConfirmDialogType } from "@/component/ConfirmDialog";

interface ConfirmDialogConfig {
  title: string;
  message: string;
  type?: ConfirmDialogType;
  confirmText?: string;
  cancelText?: string;
}

export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<ConfirmDialogConfig>({
    title: "",
    message: "",
    type: "warning",
    confirmText: "Confirm",
    cancelText: "Cancel",
  });
  const [onConfirmCallback, setOnConfirmCallback] = useState<(() => void) | null>(null);

  const showDialog = (dialogConfig: ConfirmDialogConfig, onConfirm?: () => void) => {
    setConfig({
      ...dialogConfig,
      type: dialogConfig.type || "warning",
      confirmText: dialogConfig.confirmText || "Confirm",
      cancelText: dialogConfig.cancelText || "Cancel",
    });
    setOnConfirmCallback(() => onConfirm || (() => {}));
    setIsOpen(true);
  };

  const handleConfirm = () => {
    if (onConfirmCallback) {
      onConfirmCallback();
    }
    setIsOpen(false);
  };

  const handleCancel = () => {
    setIsOpen(false);
  };

  const DialogComponent = (
    <ConfirmDialog
      open={isOpen}
      title={config.title}
      message={config.message}
      type={config.type}
      confirmText={config.confirmText}
      cancelText={config.cancelText}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return {
    showDialog,
    DialogComponent,
  };
}
