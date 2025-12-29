"use client";

import { raleway } from "@/utils/front";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

export type ConfirmDialogType = "warning" | "danger" | "info" | "success";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  type?: ConfirmDialogType;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  type = "warning",
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const getIcon = () => {
    switch (type) {
      case "danger":
        return <XCircle className="w-12 h-12 text-red-500" />;
      case "warning":
        return <AlertTriangle className="w-12 h-12 text-yellow-500" />;
      case "success":
        return <CheckCircle2 className="w-12 h-12 text-green-500" />;
      case "info":
        return <Info className="w-12 h-12 text-blue-500" />;
    }
  };

  const getConfirmButtonStyles = () => {
    switch (type) {
      case "danger":
        return "bg-red-600 hover:bg-red-700 focus:ring-red-500";
      case "warning":
        return "bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500";
      case "success":
        return "bg-green-600 hover:bg-green-700 focus:ring-green-500";
      case "info":
        return "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500";
    }
  };

  return (
    <div
      className={`${raleway.className} fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] animate-in fade-in duration-200`}
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <div className="mb-4">{getIcon()}</div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
          
          <p className="text-gray-600 mb-6">{message}</p>

          <div className="flex gap-3 w-full">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
            >
              {cancelText}
            </button>
            
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-2.5 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${getConfirmButtonStyles()}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
