'use client';

import { FormEvent, useEffect, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

type ReportFormData = {
  category: string;
  reason: string;
  description: string;
  screenshots: string[];
};

interface ProfileReportModalProps {
  open: boolean;
  title: string;
  targetLabel: string;
  onClose: () => void;
  onSubmit: (data: ReportFormData) => Promise<void> | void;
  loading?: boolean;
}

const INITIAL_FORM: ReportFormData = {
  category: 'Profile',
  reason: '',
  description: '',
  screenshots: [],
};

export default function ProfileReportModal({
  open,
  title,
  targetLabel,
  onClose,
  onSubmit,
  loading = false,
}: ProfileReportModalProps) {
  const [form, setForm] = useState<ReportFormData>(INITIAL_FORM);
  const [screenshotsText, setScreenshotsText] = useState('');

  useEffect(() => {
    if (!open) return;

    setForm(INITIAL_FORM);
    setScreenshotsText('');
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const screenshots = screenshotsText
      .split(/\n|,/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    await onSubmit({
      ...form,
      screenshots,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">Report profile</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{targetLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Close report dialog"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Category</label>
            <input
              type="text"
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              placeholder="Harassment, spam, impersonation, scam..."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Reason</label>
            <textarea
              value={form.reason}
              onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
              placeholder="Explain why you are reporting this profile"
              rows={4}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Description</label>
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Optional extra details for admin review"
              rows={3}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Screenshot URLs</label>
            <textarea
              value={screenshotsText}
              onChange={(event) => setScreenshotsText(event.target.value)}
              placeholder="Paste screenshot URLs, one per line or separated by commas"
              rows={3}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
