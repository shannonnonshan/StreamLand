'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { 
  XMarkIcon, 
  ArrowLeftIcon, 
  AcademicCapIcon,
  DocumentIcon,
  UserIcon,
  UserGroupIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';

// Emails from GitHub/Google that are not real inboxes
const isNoReplyEmail = (email: string) =>
  !email ||
  email.includes('noreply.github.com') ||
  email.includes('privaterelay.appleid.com') ||
  email.trim() === '';

interface CompleteOAuthModalProps {
  isOpen: boolean;
  closeModal: () => void;
  provider: 'google' | 'github';
  profile: {
    socialId: string;
    email: string;
    fullName: string;
    avatar?: string;
  };
  onComplete: (data: {
    role: 'STUDENT' | 'TEACHER';
    approvalEmail: string;
    teacherCV?: File;
    subjects?: string[];
    experience?: number;
    education?: string;
    teacherIntroduction?: string;
    studentSchool?: string;
    studentClass?: string;
  }) => void;
}

export default function CompleteOAuthModal({
  isOpen,
  closeModal,
  provider,
  profile,
  onComplete,
}: CompleteOAuthModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState<'STUDENT' | 'TEACHER' | null>(null);
  
  // Email for approval notifications
  const profileEmailValid = !isNoReplyEmail(profile.email);
  const [approvalEmail, setApprovalEmail] = useState('');

  // Teacher fields
  const [teacherCV, setTeacherCV] = useState<File | null>(null);
  const [teacherSubjects, setTeacherSubjects] = useState('');
  const [teacherExperience, setTeacherExperience] = useState('');
  const [teacherSpecialty, setTeacherSpecialty] = useState('');
  const [teacherIntroduction, setTeacherIntroduction] = useState('');
  
  // Student fields
  const [studentSchool, setStudentSchool] = useState('');
  const [studentClass, setStudentClass] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Pre-fill email from profile if it's valid
  useEffect(() => {
    if (profileEmailValid) {
      setApprovalEmail(profile.email);
    } else {
      setApprovalEmail('');
    }
  }, [profile.email, profileEmailValid]);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1);
      setSelectedRole(null);
      setTeacherCV(null);
      setTeacherSubjects('');
      setTeacherExperience('');
      setTeacherSpecialty('');
      setTeacherIntroduction('');
      setStudentSchool('');
      setStudentClass('');
      setError('');
      setFormErrors({});
      if (profileEmailValid) {
        setApprovalEmail(profile.email);
      } else {
        setApprovalEmail('');
      }
    }
  }, [isOpen]);

  const handleNext = () => {
    if (currentStep === 1) {
      if (!selectedRole) {
        setError('Please select a role');
        return;
      }
      setError('');
      setCurrentStep(2);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setError('');
      setFormErrors({});
      setCurrentStep(currentStep - 1);
    }
  };

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email) && !isNoReplyEmail(email);
  };

  const validateStep2 = (): boolean => {
    const errors: Record<string, string> = {};

    // Always validate approval email
    if (!approvalEmail.trim()) {
      errors.approvalEmail = 'Email is required to receive account notifications';
    } else if (!validateEmail(approvalEmail)) {
      errors.approvalEmail = 'Please enter a valid email address';
    }
    
    if (selectedRole === 'TEACHER') {
      if (!teacherCV) errors.teacherCV = 'Please upload your CV';
      if (!teacherSubjects) errors.teacherSubjects = 'Please enter subjects you teach';
      if (!teacherExperience) errors.teacherExperience = 'Please enter years of experience';
      if (!teacherSpecialty) errors.teacherSpecialty = 'Please enter your specialty';
      if (!teacherIntroduction) errors.teacherIntroduction = 'Please enter your introduction';
    } else if (selectedRole === 'STUDENT') {
      if (!studentSchool) errors.studentSchool = 'Please enter school name';
      if (!studentClass) errors.studentClass = 'Please enter class';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep2()) return;

    setIsSubmitting(true);
    setError('');

    try {
      const data: Parameters<typeof onComplete>[0] = {
        role: selectedRole!,
        approvalEmail: approvalEmail.trim(),
      };
      
      if (selectedRole === 'TEACHER') {
        data.teacherCV = teacherCV ?? undefined;
        data.subjects = teacherSubjects.split(',').map(s => s.trim()).filter(Boolean);
        data.experience = parseInt(teacherExperience) || 0;
        data.education = teacherSpecialty;
        data.teacherIntroduction = teacherIntroduction;
      } else if (selectedRole === 'STUDENT') {
        data.studentSchool = studentSchool;
        data.studentClass = studentClass;
      }
      
      await onComplete(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error occurred during registration');
      setIsSubmitting(false);
    }
  };

  const providerName = provider === 'google' ? 'Google' : 'GitHub';
  const providerIcon = provider === 'github' ? '🐙' : '🔵';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 overflow-y-auto"
          onClick={closeModal}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-[#161853] to-[#292C6D] p-6 text-white relative">
              {currentStep > 1 && (
                <button
                  onClick={handleBack}
                  className="absolute top-4 left-4 text-white hover:bg-white/20 rounded-full p-1 transition-colors"
                >
                  <ArrowLeftIcon className="w-6 h-6" />
                </button>
              )}
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full p-1 transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
              <h2 className="text-2xl font-bold text-center">
                {currentStep === 1 ? 'Select Your Role' : 'Complete Your Profile'}
              </h2>
              <p className="text-sm mt-2 text-white/80 text-center">
                {currentStep === 1
                  ? `Almost there! One last step to finish registering via ${providerName}`
                  : selectedRole === 'TEACHER'
                    ? 'Provide your teaching credentials'
                    : 'Tell us about yourself'}
              </p>
              {/* Progress dots */}
              <div className="flex justify-center gap-2 mt-4">
                {[1, 2].map((step) => (
                  <div
                    key={step}
                    className={`h-2 rounded-full transition-all ${
                      step <= currentStep ? 'w-8 bg-white' : 'w-2 bg-white/30'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Profile Info Bar */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-4">
              {profile.avatar ? (
                <Image
                  src={profile.avatar}
                  alt={profile.fullName}
                  width={44}
                  height={44}
                  className="rounded-full border-2 border-[#161853]/20 shrink-0"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-[#161853] flex items-center justify-center text-white font-bold shrink-0">
                  {profile.fullName.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">{profile.fullName}</p>
                <p className="text-xs text-gray-500">
                  {providerIcon} Signed in via {providerName}
                </p>
              </div>
            </div>

            {/* Form Content */}
            <div className="p-6 space-y-5">
              {/* Error banner */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* ── Step 1: Role Selection ── */}
              {currentStep === 1 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Which role would you like to register as? <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { role: 'STUDENT' as const, emoji: '🎓', label: 'Student', sub: 'Join and learn' },
                      { role: 'TEACHER' as const, emoji: '👨‍🏫', label: 'Teacher', sub: 'Teach and inspire' },
                    ].map(({ role, emoji, label, sub }) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setSelectedRole(role)}
                        className={`p-5 rounded-xl border-2 transition-all text-left ${
                          selectedRole === role
                            ? 'border-[#161853] bg-[#161853]/5 shadow-md'
                            : 'border-gray-200 hover:border-[#161853]/40'
                        }`}
                      >
                        <div className="text-3xl mb-2">{emoji}</div>
                        <div className="font-semibold text-gray-900">{label}</div>
                        <div className="text-xs text-gray-500 mt-1">{sub}</div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── Step 2: Details + Email ── */}
              {currentStep === 2 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >

                  {/* ── Email field (always shown in step 2) ── */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notification Email <span className="text-red-500">*</span>
                    </label>

                    {profileEmailValid ? (
                      /* Email from provider is valid — show as confirmed, readonly */
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="email"
                          value={approvalEmail}
                          readOnly
                          className="block w-full rounded-xl border-0 py-2.5 pl-10 pr-12 ring-1 ring-inset ring-green-400 bg-green-50 text-gray-700 cursor-not-allowed"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                          <span className="text-green-500 text-xs font-semibold flex items-center gap-1">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Confirmed
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* No valid email from provider — require user to enter */
                      <div>
                        <div className="mb-2 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <p className="text-xs text-amber-700">
                            {provider === 'github'
                              ? 'GitHub did not share your email (private setting). Please enter your real email — we\'ll use it to notify you when your account is approved.'
                              : 'We could not retrieve your email. Please enter it below.'}
                          </p>
                        </div>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                            type="email"
                            value={approvalEmail}
                            onChange={(e) => {
                              setApprovalEmail(e.target.value);
                              setFormErrors({ ...formErrors, approvalEmail: '' });
                            }}
                            className={`block w-full rounded-xl border-0 py-2.5 pl-10 pr-4 ring-1 ring-inset ${
                              formErrors.approvalEmail ? 'ring-red-400 bg-red-50' : 'ring-gray-300'
                            } focus:ring-2 focus:ring-[#161853]`}
                            placeholder="your@email.com"
                            autoFocus
                          />
                        </div>
                        {formErrors.approvalEmail && (
                          <p className="mt-1 text-sm text-red-600">{formErrors.approvalEmail}</p>
                        )}
                      </div>
                    )}

                    <p className="mt-1.5 text-xs text-gray-500">
                      {selectedRole === 'TEACHER'
                        ? 'We\'ll send your approval notification to this email.'
                        : 'We\'ll use this email for important account notifications.'}
                    </p>
                  </div>

                  {/* ── Teacher-specific fields ── */}
                  {selectedRole === 'TEACHER' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Curriculum Vitae (CV) <span className="text-red-500">*</span>
                        </label>
                        <div className={`flex justify-center px-6 py-4 border-2 border-dashed rounded-xl ${
                          formErrors.teacherCV ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-[#161853]/40'
                        } transition-colors`}>
                          <div className="space-y-2 text-center">
                            <DocumentIcon className="mx-auto h-8 w-8 text-gray-400" />
                            <div className="flex text-sm text-gray-600 justify-center">
                              <label className="relative cursor-pointer rounded-md bg-white font-medium text-[#161853] hover:opacity-80">
                                <span>Upload CV</span>
                                <input
                                  type="file"
                                  className="sr-only"
                                  accept=".pdf,.doc,.docx"
                                  onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                      setTeacherCV(e.target.files[0]);
                                      setFormErrors({ ...formErrors, teacherCV: '' });
                                    }
                                  }}
                                />
                              </label>
                              <p className="pl-1">or drag and drop</p>
                            </div>
                            <p className="text-xs text-gray-500">PDF, DOC, DOCX · max 10MB</p>
                            {teacherCV && <p className="text-sm text-green-600 font-medium">✓ {teacherCV.name}</p>}
                          </div>
                        </div>
                        {formErrors.teacherCV && <p className="mt-1 text-sm text-red-600">{formErrors.teacherCV}</p>}
                      </div>

                      {[
                        { label: 'Teaching Subjects', key: 'teacherSubjects', value: teacherSubjects, set: setTeacherSubjects, placeholder: 'E.g., Math, Physics, Chemistry', icon: AcademicCapIcon },
                        { label: 'Years of Experience', key: 'teacherExperience', value: teacherExperience, set: setTeacherExperience, placeholder: 'E.g., 5', icon: UserIcon },
                        { label: 'Specialty', key: 'teacherSpecialty', value: teacherSpecialty, set: setTeacherSpecialty, placeholder: 'E.g., Advanced Math, University Exam Prep', icon: AcademicCapIcon },
                      ].map(({ label, key, value, set, placeholder, icon: Icon }) => (
                        <div key={key}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {label} <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                              <Icon className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                              type="text"
                              value={value}
                              onChange={(e) => { set(e.target.value); setFormErrors({ ...formErrors, [key]: '' }); }}
                              className={`block w-full rounded-xl border-0 py-2.5 pl-10 pr-4 ring-1 ring-inset ${
                                formErrors[key] ? 'ring-red-400 bg-red-50' : 'ring-gray-300'
                              } focus:ring-2 focus:ring-[#161853]`}
                              placeholder={placeholder}
                            />
                          </div>
                          {formErrors[key] && <p className="mt-1 text-sm text-red-600">{formErrors[key]}</p>}
                        </div>
                      ))}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Self Introduction <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={teacherIntroduction}
                          onChange={(e) => { setTeacherIntroduction(e.target.value); setFormErrors({ ...formErrors, teacherIntroduction: '' }); }}
                          rows={3}
                          className={`block w-full rounded-xl border-0 py-2.5 px-4 ring-1 ring-inset ${
                            formErrors.teacherIntroduction ? 'ring-red-400 bg-red-50' : 'ring-gray-300'
                          } focus:ring-2 focus:ring-[#161853]`}
                          placeholder="Introduce your experience and teaching methods"
                        />
                        {formErrors.teacherIntroduction && <p className="mt-1 text-sm text-red-600">{formErrors.teacherIntroduction}</p>}
                      </div>
                    </>
                  )}

                  {/* ── Student-specific fields ── */}
                  {selectedRole === 'STUDENT' && (
                    <>
                      {[
                        { label: 'School', key: 'studentSchool', value: studentSchool, set: setStudentSchool, placeholder: 'E.g., Nguyen Hue High School', icon: AcademicCapIcon },
                        { label: 'Class', key: 'studentClass', value: studentClass, set: setStudentClass, placeholder: 'E.g., 12A1', icon: UserGroupIcon },
                      ].map(({ label, key, value, set, placeholder, icon: Icon }) => (
                        <div key={key}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {label} <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                              <Icon className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                              type="text"
                              value={value}
                              onChange={(e) => { set(e.target.value); setFormErrors({ ...formErrors, [key]: '' }); }}
                              className={`block w-full rounded-xl border-0 py-2.5 pl-10 pr-4 ring-1 ring-inset ${
                                formErrors[key] ? 'ring-red-400 bg-red-50' : 'ring-gray-300'
                              } focus:ring-2 focus:ring-[#161853]`}
                              placeholder={placeholder}
                            />
                          </div>
                          {formErrors[key] && <p className="mt-1 text-sm text-red-600">{formErrors[key]}</p>}
                        </div>
                      ))}
                    </>
                  )}
                </motion.div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                {currentStep === 1 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!selectedRole}
                    className={`w-full py-3 rounded-xl font-semibold text-white transition-all ${
                      !selectedRole
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-[#EC255A] hover:opacity-90 shadow-md'
                    }`}
                  >
                    Next →
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleBack}
                      className="w-1/3 py-3 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className={`w-2/3 py-3 rounded-xl font-semibold text-white transition-all ${
                        isSubmitting
                          ? 'bg-gray-300 cursor-not-allowed'
                          : 'bg-[#EC255A] hover:opacity-90 shadow-md'
                      }`}
                    >
                      {isSubmitting ? 'Processing...' : 'Complete Registration'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}