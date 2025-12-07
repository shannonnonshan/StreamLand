"use client";

import React from "react";
import { AlertCircle, XIcon } from "lucide-react";
import { raleway } from "@/utils/front";

interface EarlyStartWarningModalProps {
  open: boolean;
  onClose: () => void;
  scheduledDate: string;
  scheduledTime: string;
  onStartNow: () => void;
  onStartNewLivestream?: () => void;
  isLoading?: boolean;
}

export default function EarlyStartWarningModal({
  open,
  onClose,
  scheduledDate,
  scheduledTime,
  onStartNow,
  onStartNewLivestream,
  isLoading = false,
}: EarlyStartWarningModalProps) {
  if (!open) return null;

  return (
    <div
      className={`${raleway.className} fixed inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-300 z-50`}
    >
      <div className="relative bg-white rounded-xl p-8 w-full max-w-md shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <XIcon size={24} />
        </button>

        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0">
            <AlertCircle className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Schedule Not Started Yet
            </h3>
            <p className="text-sm text-gray-600">
              This livestream is scheduled for{" "}
              <strong>
                {scheduledDate} at {scheduledTime}
              </strong>
              . Starting now will begin a new livestream immediately.
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded">
          <p className="text-sm text-blue-800">
            💡 <strong>Tip:</strong> You can start a new livestream now, or wait until the scheduled time to start the planned session.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={onClose}
            className="px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors text-base"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onStartNewLivestream?.();
              onClose();
            }}
            disabled={isLoading}
            className="px-4 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Starting...
              </>
            ) : (
              "Start New Livestream Now"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
