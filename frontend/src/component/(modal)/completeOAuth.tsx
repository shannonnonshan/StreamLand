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
  UserGroupIcon
} from '@heroicons/react/24/outline';

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
    // Teacher fields
    teacherCV?: File;
    teacherSubjects?: string;
    teacherExperience?: string;
    teacherSpecialty?: string;
    teacherIntroduction?: string;
    // Student fields
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

  const validateStep2 = (): boolean => {
    const errors: Record<string, string> = {};
    
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

    if (!validateStep2()) {
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const data: {
        role: 'STUDENT' | 'TEACHER';
        teacherCV?: File;
        teacherSubjects?: string;
        teacherExperience?: string;
        teacherSpecialty?: string;
        teacherIntroduction?: string;
        studentSchool?: string;
        studentClass?: string;
      } = {
        role: selectedRole!,
      };
      
      if (selectedRole === 'TEACHER') {
        data.teacherCV = teacherCV ?? undefined;
        data.teacherSubjects = teacherSubjects;
        data.teacherExperience = teacherExperience;
        data.teacherSpecialty = teacherSpecialty;
        data.teacherIntroduction = teacherIntroduction;
      } else if (selectedRole === 'STUDENT') {
        data.studentSchool = studentSchool;
        data.studentClass = studentClass;
      }
      
      await onComplete(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
      setIsSubmitting(false);
    }
  };

  const providerName = provider === 'google' ? 'Google' : 'GitHub';

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
            <div className="bg-gradient-to-r from-purple-600 to-blue-500 p-6 text-white relative">
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
                {currentStep === 1 ? 'Select Role' : 'Detail Information'}
              </h2>
              <p className="text-sm mt-2 text-white/90 text-center">
                {currentStep === 1
                  ? `Complete registration via ${providerName}`
                  : selectedRole === 'TEACHER'
                    ? 'Provide teacher information' 
                    : 'Provide student information'}
              </p>
              {/* Progress Indicator */}
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

            {/* Profile Info */}
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-4">
                {profile.avatar && (
                  <Image
                    src={profile.avatar}
                    alt={profile.fullName}
                    width={64}
                    height={64}
                    className="rounded-full border-2 border-purple-500"
                  />
                )}
                <div>
                  <p className="font-semibold text-gray-900">{profile.fullName}</p>
                  <p className="text-sm text-gray-600">{profile.email}</p>
                </div>
              </div>
            </div>

            {/* Form Content */}
            <div className="p-6 space-y-6">
              {/* Error Message */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-red-500 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Step 1: Role Selection */}
              {currentStep === 1 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Bạn muốn đăng ký với vai trò nào? <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setSelectedRole('STUDENT')}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        selectedRole === 'STUDENT'
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <div className="text-3xl mb-2">🎓</div>
                      <div className="font-semibold text-gray-900">Student</div>
                      <div className="text-xs text-gray-600 mt-1">Join learning</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRole('TEACHER')}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        selectedRole === 'TEACHER'
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <div className="text-3xl mb-2">👨‍🏫</div>
                      <div className="font-semibold text-gray-900">Teacher</div>
                      <div className="text-xs text-gray-600 mt-1">Teach courses</div>
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Role-Specific Info */}
              {currentStep === 2 && selectedRole === 'TEACHER' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <h4 className="text-lg font-semibold text-gray-700">Teacher Information</h4>
                  
                  {/* CV Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Curriculum Vitae (CV) <span className="text-red-500">*</span>
                    </label>
                    <div className={`mt-1 flex justify-center px-6 py-4 border-2 border-dashed rounded-lg ${
                      formErrors.teacherCV ? 'border-red-300' : 'border-gray-300'
                    }`}>
                      <div className="space-y-2 text-center">
                        <DocumentIcon className="mx-auto h-8 w-8 text-gray-400" />
                        <div className="flex text-sm text-gray-600">
                          <label className="relative cursor-pointer rounded-md bg-white font-medium text-purple-600 hover:text-purple-500">
                            <span>Upload CV</span>
                            <input 
                              type="file" 
                              className="sr-only" 
                              accept=".pdf,.doc,.docx"
                              onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  setTeacherCV(e.target.files[0]);
                                  setFormErrors({...formErrors, teacherCV: ''});
                                }
                              }}
                            />
                          </label>
                          <p className="pl-1">or drag and drop</p>
                        </div>
                        <p className="text-xs text-gray-500">PDF, DOC, DOCX max 10MB</p>
                        {teacherCV && (
                          <p className="text-sm text-green-600">{teacherCV.name}</p>
                        )}
                      </div>
                    </div>
                    {formErrors.teacherCV && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.teacherCV}</p>
                    )}
                  </div>

                  {/* Subjects */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teaching Subjects <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <AcademicCapIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={teacherSubjects}
                        onChange={(e) => {
                          setTeacherSubjects(e.target.value);
                          setFormErrors({...formErrors, teacherSubjects: ''});
                        }}
                        className={`block w-full rounded-lg border-0 py-2.5 pl-10 pr-4 ring-1 ring-inset ${
                          formErrors.teacherSubjects ? 'ring-red-500' : 'ring-gray-300'
                        } focus:ring-2 focus:ring-purple-500`}
                        placeholder="E.g., Math, Physics, Chemistry"
                      />
                    </div>
                    {formErrors.teacherSubjects && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.teacherSubjects}</p>
                    )}
                  </div>

                  {/* Experience */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Years of Experience <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={teacherExperience}
                      onChange={(e) => {
                        setTeacherExperience(e.target.value);
                        setFormErrors({...formErrors, teacherExperience: ''});
                      }}
                      className={`block w-full rounded-lg border-0 py-2.5 px-4 ring-1 ring-inset ${
                        formErrors.teacherExperience ? 'ring-red-500' : 'ring-gray-300'
                      } focus:ring-2 focus:ring-purple-500`}
                      placeholder="E.g., 5 years"
                    />
                    {formErrors.teacherExperience && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.teacherExperience}</p>
                    )}
                  </div>

                  {/* Specialty */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Specialty <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={teacherSpecialty}
                      onChange={(e) => {
                        setTeacherSpecialty(e.target.value);
                        setFormErrors({...formErrors, teacherSpecialty: ''});
                      }}
                      className={`block w-full rounded-lg border-0 py-2.5 px-4 ring-1 ring-inset ${
                        formErrors.teacherSpecialty ? 'ring-red-500' : 'ring-gray-300'
                      } focus:ring-2 focus:ring-purple-500`}
                      placeholder="E.g., Advanced Math, University Exam Prep"
                    />
                    {formErrors.teacherSpecialty && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.teacherSpecialty}</p>
                    )}
                  </div>

                  {/* Introduction */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Self Introduction <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute top-3 left-0 pl-3">
                        <UserIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <textarea
                        value={teacherIntroduction}
                        onChange={(e) => {
                          setTeacherIntroduction(e.target.value);
                          setFormErrors({...formErrors, teacherIntroduction: ''});
                        }}
                        rows={3}
                        className={`block w-full rounded-lg border-0 py-2.5 pl-10 pr-4 ring-1 ring-inset ${
                          formErrors.teacherIntroduction ? 'ring-red-500' : 'ring-gray-300'
                        } focus:ring-2 focus:ring-purple-500`}
                        placeholder="Introduce your experience and teaching methods"
                      />
                    </div>
                    {formErrors.teacherIntroduction && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.teacherIntroduction}</p>
                    )}
                  </div>
                </motion.div>
              )}

              {currentStep === 2 && selectedRole === 'STUDENT' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <h4 className="text-lg font-semibold text-gray-700">Student Information</h4>
                  
                  {/* School */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      School <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <AcademicCapIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={studentSchool}
                        onChange={(e) => {
                          setStudentSchool(e.target.value);
                          setFormErrors({...formErrors, studentSchool: ''});
                        }}
                        className={`block w-full rounded-lg border-0 py-2.5 pl-10 pr-4 ring-1 ring-inset ${
                          formErrors.studentSchool ? 'ring-red-500' : 'ring-gray-300'
                        } focus:ring-2 focus:ring-purple-500`}
                        placeholder="E.g., Nguyen Hue High School"
                      />
                    </div>
                    {formErrors.studentSchool && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.studentSchool}</p>
                    )}
                  </div>

                  {/* Class */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Class <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <UserGroupIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={studentClass}
                        onChange={(e) => {
                          setStudentClass(e.target.value);
                          setFormErrors({...formErrors, studentClass: ''});
                        }}
                        className={`block w-full rounded-lg border-0 py-2.5 pl-10 pr-4 ring-1 ring-inset ${
                          formErrors.studentClass ? 'ring-red-500' : 'ring-gray-300'
                        } focus:ring-2 focus:ring-purple-500`}
                        placeholder="E.g., 12A1"
                      />
                    </div>
                    {formErrors.studentClass && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.studentClass}</p>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                {currentStep === 1 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!selectedRole}
                    className={`w-full py-3 rounded-lg font-semibold text-white transition-all ${
                      !selectedRole
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-[#EC255A] hover:opacity-90'
                    }`}
                  >
                    Next
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleBack}
                      className="w-1/3 py-3 rounded-lg font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 transition-all"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className={`w-2/3 py-3 rounded-lg font-semibold text-white transition-all ${
                        isSubmitting
                          ? 'bg-gray-300 cursor-not-allowed'
                          : 'bg-[#EC255A] hover:opacity-90'
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
