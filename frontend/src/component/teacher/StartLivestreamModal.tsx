'use client';

import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useState } from 'react';
import { XMarkIcon, VideoCameraIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

const PrimaryColor = '161853';

interface StartLivestreamModalProps {
  isOpen: boolean;
  closeModal: () => void;
  onStartLivestream: (data: LivestreamData) => void;
  teacherId: string;
}

export interface LivestreamData {
  title: string;
  description: string;
  category: string;
  thumbnail?: string;
  isPublic: boolean;
  allowComments: boolean;
}

const categories = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'English',
  'Literature',
  'History',
  'Geography',
  'Computer Science',
  'Economics',
  'Other'
];

export default function StartLivestreamModal({
  isOpen,
  closeModal,
  onStartLivestream,
}: StartLivestreamModalProps) {
  const [formData, setFormData] = useState<LivestreamData>({
    title: '',
    description: '',
    category: 'Mathematics',
    isPublic: true,
    allowComments: true,
  });

  const [errors, setErrors] = useState<{
    title?: string;
    description?: string;
  }>({});

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    // Clear error when user types
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validate = () => {
    const newErrors: typeof errors = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length < 5) {
      newErrors.title = 'Title must be at least 5 characters';
    } else if (formData.title.length > 100) {
      newErrors.title = 'Title must be less than 100 characters';
    }
    
    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setIsSubmitting(true);
    try {
      await onStartLivestream(formData);
      // Modal will be closed by parent after redirect
    } catch (error) {
      console.error('Error starting livestream:', error);
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData({
        title: '',
        description: '',
        category: 'Mathematics',
        isPublic: true,
        allowComments: true,
      });
      setErrors({});
      closeModal();
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={`w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-8 text-left align-middle shadow-2xl transition-all border-t-4 border-[#${PrimaryColor}]`}>
                
                {/* Close Button */}
                <button
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>

                {/* Header */}
                <Dialog.Title
                  as="h3"
                  className={`text-2xl font-extrabold leading-6 text-[#${PrimaryColor}] flex items-center gap-3 mb-2`}
                >
                  <div className={`p-2 bg-[#${PrimaryColor}] rounded-lg`}>
                    <VideoCameraIcon className="h-6 w-6 text-white" />
                  </div>
                  Start Livestream
                </Dialog.Title>
                <p className="text-sm text-gray-600 mb-6">
                  Fill in the details to start your live session
                </p>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                  
                  {/* Title */}
                  <div>
                    <label htmlFor="title" className="block text-sm font-semibold text-gray-700 mb-2">
                      Livestream Title <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        id="title"
                        name="title"
                        type="text"
                        required
                        value={formData.title}
                        onChange={handleChange}
                        disabled={isSubmitting}
                        placeholder="e.g., Advanced Calculus - Derivatives"
                        className={`block w-full rounded-lg border-0 py-3 pl-10 pr-4 ring-1 ring-inset ${
                          errors.title ? 'ring-red-500' : 'ring-gray-300'
                        } focus:ring-2 focus:ring-[#${PrimaryColor}] disabled:opacity-50`}
                      />
                    </div>
                    {errors.title && (
                      <p className="mt-1 text-sm text-red-600">{errors.title}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      {formData.title.length}/100 characters
                    </p>
                  </div>

                  {/* Category */}
                  <div>
                    <label htmlFor="category" className="block text-sm font-semibold text-gray-700 mb-2">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="category"
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      className={`block w-full rounded-lg border-0 py-3 px-4 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-[#${PrimaryColor}] disabled:opacity-50`}
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Description */}
                  <div>
                    <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      rows={4}
                      placeholder="Describe what topics you'll cover in this livestream..."
                      className={`block w-full rounded-lg border-0 py-3 px-4 ring-1 ring-inset ${
                        errors.description ? 'ring-red-500' : 'ring-gray-300'
                      } focus:ring-2 focus:ring-[#${PrimaryColor}] disabled:opacity-50`}
                    />
                    {errors.description && (
                      <p className="mt-1 text-sm text-red-600">{errors.description}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      {formData.description.length}/500 characters
                    </p>
                  </div>

                  {/* Settings */}
                  <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h4 className="font-semibold text-gray-700 text-sm mb-3">Livestream Settings</h4>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label htmlFor="isPublic" className="text-sm font-medium text-gray-700">
                          Public Livestream
                        </label>
                        <span className="text-xs text-gray-500">(Anyone can join)</span>
                      </div>
                      <input
                        id="isPublic"
                        name="isPublic"
                        type="checkbox"
                        checked={formData.isPublic}
                        onChange={handleChange}
                        disabled={isSubmitting}
                        className="h-4 w-4 rounded border-gray-300 text-[#EC255A] focus:ring-[#EC255A]"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label htmlFor="allowComments" className="text-sm font-medium text-gray-700">
                          Allow Comments
                        </label>
                        <span className="text-xs text-gray-500">(Students can chat)</span>
                      </div>
                      <input
                        id="allowComments"
                        name="allowComments"
                        type="checkbox"
                        checked={formData.allowComments}
                        onChange={handleChange}
                        disabled={isSubmitting}
                        className="h-4 w-4 rounded border-gray-300 text-[#EC255A] focus:ring-[#EC255A]"
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={isSubmitting}
                      className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#${PrimaryColor}] to-[#EC255A] text-white rounded-lg font-semibold hover:shadow-lg transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Starting...
                        </>
                      ) : (
                        <>
                          <VideoCameraIcon className="h-5 w-5" />
                          Go Live
                        </>
                      )}
                    </button>
                  </div>
                </form>

              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
