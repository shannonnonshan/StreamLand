"use client";

import { useState, useCallback } from "react";
import Toast, { ToastType } from "@/component/Toast";

interface ToastState {
  message: string;
  type: ToastType;
  show: boolean;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState>({
    message: "",
    type: "info",
    show: false,
  });

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    setToast({ message, type, show: true });
  }, []);

  const success = useCallback((message: string) => {
    showToast(message, "success");
  }, [showToast]);

  const error = useCallback((message: string) => {
    showToast(message, "error");
  }, [showToast]);

  const warning = useCallback((message: string) => {
    showToast(message, "warning");
  }, [showToast]);

  const info = useCallback((message: string) => {
    showToast(message, "info");
  }, [showToast]);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, show: false }));
  }, []);

  const ToastComponent = toast.show ? (
    <Toast
      message={toast.message}
      type={toast.type}
      onClose={hideToast}
    />
  ) : null;

  return {
    showToast,
    success,
    error,
    warning,
    info,
    ToastComponent,
  };
}
