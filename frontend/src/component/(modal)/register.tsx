// components/Auth/RegisterModal.jsx
import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { 
  AtSymbolIcon, 
  LockClosedIcon, 
  AcademicCapIcon, 
  UserGroupIcon, 
  UserIcon, 
  ArrowRightIcon, 
  ExclamationCircleIcon, 
  EyeIcon, 
  EyeSlashIcon, 
  CheckCircleIcon,
  DocumentIcon,
  DocumentDuplicateIcon,
  KeyIcon,
  IdentificationIcon
} from '@heroicons/react/24/outline';

const PrimaryColor = '161853'; // Xanh Đậm (màu chủ đạo mới)
const SecondaryColor = 'EC255A'; // Đỏ/Hồng

// Component cho các bước
const steps = [
  { id: 'Step 1', name: 'Personal Info', fields: ['fullName', 'email', 'password', 'confirmPassword'] },
  { id: 'Step 2', name: 'Role', fields: ['role'] },
  { id: 'Step 3', name: 'Detail Info', fields: ['additionalInfo'] },
  { id: 'Step 4', name: 'Complete', fields: [] },
];

function ProgressIndicator({ currentStep }: { currentStep: number }) {
  return (
    <nav aria-label="Progress" className="mb-6">
      <ol role="list" className="space-y-4 sm:flex sm:space-x-8 sm:space-y-0">
        {steps.map((step, index) => (
          <li key={step.name} className="flex-1">
            <div className="group flex flex-col items-center">
              <span className={`flex h-2.5 w-full items-center justify-center rounded-full ${
                index + 1 === currentStep 
                  ? `bg-[#EC255A]` // Bước hiện tại - màu đỏ
                  : index + 1 < currentStep 
                    ? `bg-[#EC255A]` // Đã hoàn thành - màu đỏ
                    : 'bg-gray-300' // Chưa hoàn thành - màu xám
              } transition duration-300`} />
              <p className={`mt-2 text-sm font-medium ${
                index + 1 === currentStep 
                  ? `text-[#EC255A]` 
                  : index + 1 < currentStep 
                    ? `text-[#EC255A]` 
                    : 'text-gray-500'
              }`}>
                {step.name}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default function RegisterModal({
  isOpen,
  closeModal,
  openLoginModal,
  openOTPModal,
}: {
  isOpen: boolean;
  closeModal: () => void;
  openLoginModal: () => void;
  openOTPModal: (email?: string, purpose?: 'registration' | 'password-reset') => void;
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '', // 'teacher' hoặc 'student'
    // Thông tin bổ sung cho giáo viên
    teacherCV: null as File | null,
    teacherCertificates: [] as File[],
    teacherSubjects: '',
    teacherExperience: '',
    teacherIntroduction: '',
    teacherSpecialty: '',
    // Thông tin bổ sung cho học sinh
    studentID: '',
    studentSchool: '',
    studentClass: '',
  });
  const [formErrors, setFormErrors] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '',
    teacherCV: '',
    teacherCertificates: '',
    teacherSubjects: '',
    teacherExperience: '',
    teacherIntroduction: '',
    teacherSpecialty: '',
    studentID: '',
    studentSchool: '',
    studentClass: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Get register function from useAuth hook
  const { register } = useAuth();

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      return 'Email không được để trống';
    } else if (!emailRegex.test(email)) {
      return 'Invalid email format';
    }
    return '';
  };

  const validatePassword = (password: string) => {
    if (!password) {
      return 'Password is required';
    } else if (password.length < 8) {
      return 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least 1 uppercase letter';
    } else if (!/[0-9]/.test(password)) {
      return 'Password must contain at least 1 number';
    } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return 'Password must contain at least 1 special character (!@#$%^&*...)';
    }
    return '';
  };
  
  const validateConfirmPassword = (password: string, confirmPassword: string) => {
    if (!confirmPassword) {
      return 'Please confirm your password';
    } else if (password !== confirmPassword) {
      return 'Passwords do not match';
    }
    return '';
  };

  const validateName = (name: string) => {
    if (!name) {
      return 'Full name is required';
    } else if (name.length < 3) {
      return 'Full name must be at least 3 characters';
    }
    return '';
  };

  const handleChange = (e: { target: { name: string; value: string; files?: FileList | null; type?: string; }; }) => {
    const { name, value, files, type } = e.target;
    
    if (type === 'file' && files) {
      if (name === 'teacherCV') {
        setFormData({ ...formData, [name]: files[0] || null });
      } else if (name === 'teacherCertificates') {
        const certificateFiles = Array.from(files);
        setFormData({ ...formData, [name]: certificateFiles });
      }
    } else {
      setFormData({ ...formData, [name]: value });
    }
    
    // Clear errors when typing
    if (formErrors[name as keyof typeof formErrors]) {
      setFormErrors({
        ...formErrors,
        [name]: '',
      });
    }
  };

  const validateStep1 = () => {
    const nameError = validateName(formData.fullName);
    const emailError = validateEmail(formData.email);
    const passwordError = validatePassword(formData.password);
    const confirmPasswordError = validateConfirmPassword(formData.password, formData.confirmPassword);
    
    setFormErrors({
      ...formErrors,
      fullName: nameError,
      email: emailError,
      password: passwordError,
      confirmPassword: confirmPasswordError,
    });
    
    return !nameError && !emailError && !passwordError && !confirmPasswordError;
  };

  const validateStep2 = () => {
    if (!formData.role) {
      setFormErrors({
        ...formErrors,
        role: 'Please select your role',
      });
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (formData.role === 'teacher') {
      const teacherCVError = !formData.teacherCV ? 'Please upload your CV' : '';
      const teacherSubjectsError = !formData.teacherSubjects ? 'Please enter the subjects you teach' : '';
      const teacherExperienceError = !formData.teacherExperience ? 'Please enter years of experience' : '';
      const teacherIntroductionError = !formData.teacherIntroduction ? 'Please enter your introduction' : '';
      const teacherSpecialtyError = !formData.teacherSpecialty ? 'Please enter your specialty' : '';
      
      setFormErrors({
        ...formErrors,
        teacherCV: teacherCVError,
        teacherSubjects: teacherSubjectsError,
        teacherExperience: teacherExperienceError,
        teacherIntroduction: teacherIntroductionError,
        teacherSpecialty: teacherSpecialtyError,
      });
      
      return !teacherCVError && !teacherSubjectsError && !teacherExperienceError && 
             !teacherIntroductionError && !teacherSpecialtyError;
    } else if (formData.role === 'student') {
      const studentIDError = !formData.studentID ? 'Please enter your student ID' : '';
      const studentSchoolError = !formData.studentSchool ? 'Please enter your school name' : '';
      const studentClassError = !formData.studentClass ? 'Please enter your class' : '';
      
      setFormErrors({
        ...formErrors,
        studentID: studentIDError,
        studentSchool: studentSchoolError,
        studentClass: studentClassError,
      });
      
      return !studentIDError && !studentSchoolError && !studentClassError;
    }
    return false;
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      if (!validateStep1()) return;
    }
    
    if (currentStep === 2) {
      if (!validateStep2()) return;
    }
    
    if (currentStep === 3) {
      if (!validateStep3()) return;
    }
    
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    } else {
      // Bước cuối (4) - Hoàn tất - Gọi API register
      setIsSubmitting(true);
      try {
        // Map role từ 'teacher'/'student' sang 'TEACHER'/'STUDENT'
        const role = formData.role === 'teacher' ? 'TEACHER' : 'STUDENT';
        
        // Call register API
        const result = await register({
          fullName: formData.fullName,
          email: formData.email,
          password: formData.password,
          role: role as 'STUDENT' | 'TEACHER',
        });
        
        if (result.success) {
          // Registration successful, move to OTP verification
          closeModal();
          openOTPModal(formData.email, 'registration');
        } else {
          // Show error
          setFormErrors({
            ...formErrors,
            email: result.error || 'Registration failed. Please try again.',
          });
          // Go back to step 1 to show error
          setCurrentStep(1);
        }
      } catch (error) {
        console.error('Registration error:', error);
        setFormErrors({
          ...formErrors,
          email: 'Đã có lỗi xảy ra. Vui lòng thử lại.',
        });
        setCurrentStep(1);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Render các bước
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            {/* Full Name */}
            <div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <UserIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={handleChange}
                  onBlur={() => {
                    const error = validateName(formData.fullName);
                    setFormErrors({...formErrors, fullName: error});
                  }}
                  className={`block w-full rounded-lg border-0 py-2.5 pl-10 pr-4 ring-1 ring-inset 
                    ${formErrors.fullName ? 'ring-red-500 focus:ring-red-500' : `ring-gray-300 focus:ring-[#${PrimaryColor}]`} 
                    focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6 transition duration-150`}
                  placeholder="Full Name"
                />
              </div>
              {formErrors.fullName && (
                <div className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <ExclamationCircleIcon className="h-4 w-4" />
                  {formErrors.fullName}
                </div>
              )}
            </div>
            
            {/* Email */}
            <div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <AtSymbolIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={() => {
                    const error = validateEmail(formData.email);
                    setFormErrors({...formErrors, email: error});
                  }}
                  className={`block w-full rounded-lg border-0 py-2.5 pl-10 pr-4 ring-1 ring-inset
                    ${formErrors.email ? 'ring-red-500 focus:ring-red-500' : `ring-gray-300 focus:ring-[#${PrimaryColor}]`} 
                    focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6 transition duration-150`}
                  placeholder="Email Address"
                />
              </div>
              {formErrors.email && (
                <div className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <ExclamationCircleIcon className="h-4 w-4" />
                  {formErrors.email}
                </div>
              )}
            </div>
            
            {/* Password */}
            <div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <KeyIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={() => {
                    const error = validatePassword(formData.password);
                    setFormErrors({...formErrors, password: error});
                  }}
                  className={`block w-full rounded-lg border-0 py-2.5 pl-10 pr-10 ring-1 ring-inset
                    ${formErrors.password ? 'ring-red-500 focus:ring-red-500' : `ring-gray-300 focus:ring-[#${PrimaryColor}]`} 
                    focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6 transition duration-150`}
                  placeholder="Password (at least 8 characters)"
                />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute top-0 bottom-0 right-0 flex items-center pr-3 cursor-pointer"
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-500" />
                ) : (
                  <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-500" />
                )}
              </button>
              </div>
              {formErrors.password && (
                <div className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <ExclamationCircleIcon className="h-4 w-4" />
                  {formErrors.password}
                </div>
              )}
              <div className="mt-1 text-xs text-gray-500">
                Password must be at least 8 characters, including 1 uppercase, 1 number and 1 special character.
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <LockClosedIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  onBlur={() => {
                    const error = validateConfirmPassword(formData.password, formData.confirmPassword);
                    setFormErrors({...formErrors, confirmPassword: error});
                  }}
                  className={`block w-full rounded-lg border-0 py-2.5 pl-10 pr-10 ring-1 ring-inset
                    ${formErrors.confirmPassword ? 'ring-red-500 focus:ring-red-500' : `ring-gray-300 focus:ring-[#${PrimaryColor}]`} 
                    focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6 transition duration-150`}
                  placeholder="Re-enter Password"
                />
              </div>
              {formErrors.confirmPassword && (
                <div className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <ExclamationCircleIcon className="h-4 w-4" />
                  {formErrors.confirmPassword}
                </div>
              )}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <h4 className="text-lg font-semibold text-gray-700">Bạn là ai?</h4>
            <div className="grid grid-cols-2 gap-4">
              {/* Teacher Role */}
              <div 
                onClick={() => {
                  setFormData({ ...formData, role: 'teacher' });
                  setFormErrors({ ...formErrors, role: '' });
                }}
                className={`p-6 rounded-xl border-2 cursor-pointer transition duration-200 ${
                  formData.role === 'teacher' 
                    ? `border-[#${PrimaryColor}] bg-[#${PrimaryColor}]/10 shadow-lg` 
                    : formErrors.role 
                      ? 'border-red-300 hover:border-red-400'
                      : 'border-gray-200 hover:border-gray-400'
                }`}
              >
                <AcademicCapIcon className={`h-8 w-8 mx-auto ${formData.role === 'teacher' ? `text-[#${PrimaryColor}]` : 'text-gray-500'}`} />
                <p className={`mt-3 text-center font-bold ${formData.role === 'teacher' ? `text-[#${SecondaryColor}]` : 'text-gray-700'}`}>
                  Teacher
                </p>
                <p className="mt-1 text-center text-xs text-gray-500">
                  Create classes, Livestream & Teach.
                </p>
              </div>
              
              {/* Student Role */}
              <div 
                onClick={() => {
                  setFormData({ ...formData, role: 'student' });
                  setFormErrors({ ...formErrors, role: '' });
                }}
                className={`p-6 rounded-xl border-2 cursor-pointer transition duration-200 ${
                  formData.role === 'student' 
                    ? `border-[#${PrimaryColor}] bg-[#${PrimaryColor}]/10 shadow-lg` 
                    : formErrors.role 
                      ? 'border-red-300 hover:border-red-400'
                      : 'border-gray-200 hover:border-gray-400'
                }`}
              >
                <UserGroupIcon className={`h-8 w-8 mx-auto ${formData.role === 'student' ? `text-[#${PrimaryColor}]` : 'text-gray-500'}`} />
                <p className={`mt-3 text-center font-bold ${formData.role === 'student' ? `text-[#${SecondaryColor}]` : 'text-gray-700'}`}>
                  Student
                </p>
                <p className="mt-1 text-center text-xs text-gray-500">
                  Join classes & Interact.
                </p>
              </div>
            </div>
            
            {formErrors.role && (
              <div className="text-sm text-red-600 flex items-center gap-1 justify-center mt-2">
                <ExclamationCircleIcon className="h-4 w-4" />
                {formErrors.role}
              </div>
            )}
          </div>
        );
      case 3:
        if (formData.role === 'teacher') {
          return (
            <div className="space-y-6">
              <h4 className="text-lg font-semibold text-gray-700">Additional Information for Teachers</h4>
              <p className="text-sm text-gray-600">
                To ensure teaching quality, please provide your CV and relevant certificates.
              </p>
              
              {/* CV Upload */}
              <div>
                <label htmlFor="teacherCV" className="block text-sm font-medium text-gray-700 mb-1">
                  Curriculum Vitae (CV) <span className="text-red-500">*</span>
                </label>
                <div className={`mt-1 flex justify-center px-6 py-4 border-2 border-dashed rounded-lg ${
                  formErrors.teacherCV ? 'border-red-300' : 'border-gray-300'
                }`}>
                  <div className="space-y-2 text-center">
                    <DocumentIcon className="mx-auto h-8 w-8 text-gray-400" />
                    <div className="flex text-sm text-gray-600">
                      <label htmlFor="teacherCV" className="relative cursor-pointer rounded-md bg-white font-medium text-[#161853] focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 hover:text-[#EC255A]">
                        <span>Upload your CV</span>
                        <input 
                          id="teacherCV" 
                          name="teacherCV" 
                          type="file" 
                          className="sr-only" 
                          accept=".pdf,.doc,.docx"
                          onChange={handleChange}
                          required
                        />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">PDF, DOC, DOCX up to 10MB</p>
                    {formData.teacherCV && (
                      <p className="text-sm text-green-600">{formData.teacherCV.name}</p>
                    )}
                  </div>
                </div>
                {formErrors.teacherCV && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.teacherCV}</p>
                )}
              </div>
              
              {/* Certificates Upload */}
              <div>
                <label htmlFor="teacherCertificates" className="block text-sm font-medium text-gray-700 mb-1">
                  Related Certificates <span className="text-gray-500">(optional)</span>
                </label>
                <div className={`mt-1 flex justify-center px-6 py-4 border-2 border-dashed rounded-lg border-gray-300`}>
                  <div className="space-y-2 text-center">
                    <DocumentDuplicateIcon className="mx-auto h-8 w-8 text-gray-400" />
                    <div className="flex text-sm text-gray-600">
                      <label htmlFor="teacherCertificates" className="relative cursor-pointer rounded-md bg-white font-medium text-[#161853] focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 hover:text-[#EC255A]">
                        <span>Upload certificates</span>
                        <input 
                          id="teacherCertificates" 
                          name="teacherCertificates" 
                          type="file" 
                          className="sr-only" 
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={handleChange}
                          multiple
                        />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">PDF, DOC, DOCX, JPG, PNG up to 10MB</p>
                    {formData.teacherCertificates.length > 0 && (
                      <p className="text-sm text-green-600">{formData.teacherCertificates.length} files selected</p>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Môn học giảng dạy */}
              <div>
                <label htmlFor="teacherSubjects" className="block text-sm font-medium text-gray-700 mb-1">
                  Teaching Subjects <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <AcademicCapIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="teacherSubjects"
                    name="teacherSubjects"
                    type="text"
                    required
                    value={formData.teacherSubjects}
                    onChange={handleChange}
                    className={`block w-full rounded-lg border-0 py-2.5 pl-10 pr-4 ring-1 ring-inset ${
                      formErrors.teacherSubjects ? 'ring-red-500' : 'ring-gray-300'
                    } focus:ring-2 focus:ring-[#${PrimaryColor}]`}
                    placeholder="e.g., Math, Physics, Chemistry"
                  />
                </div>
                {formErrors.teacherSubjects && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.teacherSubjects}</p>
                )}
              </div>
              
              {/* Kinh nghiệm */}
              <div>
                <label htmlFor="teacherExperience" className="block text-sm font-medium text-gray-700 mb-1">
                  Years of Experience <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <DocumentIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="teacherExperience"
                    name="teacherExperience"
                    type="text"
                    required
                    value={formData.teacherExperience}
                    onChange={handleChange}
                    className={`block w-full rounded-lg border-0 py-2.5 pl-10 pr-4 ring-1 ring-inset ${
                      formErrors.teacherExperience ? 'ring-red-500' : 'ring-gray-300'
                    } focus:ring-2 focus:ring-[#${PrimaryColor}]`}
                    placeholder="e.g., 5 years"
                  />
                </div>
                {formErrors.teacherExperience && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.teacherExperience}</p>
                )}
              </div>
              
              {/* Chuyên môn */}
              <div>
                <label htmlFor="teacherSpecialty" className="block text-sm font-medium text-gray-700 mb-1">
                  Specialty <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <AcademicCapIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="teacherSpecialty"
                    name="teacherSpecialty"
                    type="text"
                    required
                    value={formData.teacherSpecialty}
                    onChange={handleChange}
                    className={`block w-full rounded-lg border-0 py-2.5 pl-10 pr-4 ring-1 ring-inset ${
                      formErrors.teacherSpecialty ? 'ring-red-500' : 'ring-gray-300'
                    } focus:ring-2 focus:ring-[#${PrimaryColor}]`}
                    placeholder="e.g., Advanced Math, College Prep"
                  />
                </div>
                {formErrors.teacherSpecialty && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.teacherSpecialty}</p>
                )}
              </div>
              
              {/* Giới thiệu */}
              <div>
                <label htmlFor="teacherIntroduction" className="block text-sm font-medium text-gray-700 mb-1">
                  Self Introduction <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute top-3 left-0 pl-3">
                    <UserIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <textarea
                    id="teacherIntroduction"
                    name="teacherIntroduction"
                    required
                    value={formData.teacherIntroduction}
                    onChange={handleChange}
                    rows={3}
                    className={`block w-full rounded-lg border-0 py-2.5 pl-10 pr-4 ring-1 ring-inset ${
                      formErrors.teacherIntroduction ? 'ring-red-500' : 'ring-gray-300'
                    } focus:ring-2 focus:ring-[#${PrimaryColor}]`}
                    placeholder="Brief introduction about yourself, experience and teaching methods"
                  />
                </div>
                {formErrors.teacherIntroduction && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.teacherIntroduction}</p>
                )}
              </div>
            </div>
          );
        } else if (formData.role === 'student') {
          return (
            <div className="space-y-6">
              <h4 className="text-lg font-semibold text-gray-700">Student Information</h4>
              <p className="text-sm text-gray-600">
                To provide appropriate content, please provide your academic information.
              </p>
              
              {/* Student ID */}
              <div>
                <label htmlFor="studentID" className="block text-sm font-medium text-gray-700 mb-1">
                  Student ID <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <IdentificationIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="studentID"
                    name="studentID"
                    type="text"
                    required
                    value={formData.studentID}
                    onChange={handleChange}
                    className={`block w-full rounded-lg border-0 py-2.5 pl-10 pr-4 ring-1 ring-inset ${
                      formErrors.studentID ? 'ring-red-500' : 'ring-gray-300'
                    } focus:ring-2 focus:ring-[#${PrimaryColor}]`}
                    placeholder="e.g., ST12345"
                  />
                </div>
                {formErrors.studentID && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.studentID}</p>
                )}
              </div>
              
              {/* School */}
              <div>
                <label htmlFor="studentSchool" className="block text-sm font-medium text-gray-700 mb-1">
                  School <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <AcademicCapIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="studentSchool"
                    name="studentSchool"
                    type="text"
                    required
                    value={formData.studentSchool}
                    onChange={handleChange}
                    className={`block w-full rounded-lg border-0 py-2.5 pl-10 pr-4 ring-1 ring-inset ${
                      formErrors.studentSchool ? 'ring-red-500' : 'ring-gray-300'
                    } focus:ring-2 focus:ring-[#${PrimaryColor}]`}
                    placeholder="e.g., Lincoln High School"
                  />
                </div>
                {formErrors.studentSchool && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.studentSchool}</p>
                )}
              </div>
              
              {/* Class */}
              <div>
                <label htmlFor="studentClass" className="block text-sm font-medium text-gray-700 mb-1">
                  Class <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <UserGroupIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="studentClass"
                    name="studentClass"
                    type="text"
                    required
                    value={formData.studentClass}
                    onChange={handleChange}
                    className={`block w-full rounded-lg border-0 py-2.5 pl-10 pr-4 ring-1 ring-inset ${
                      formErrors.studentClass ? 'ring-red-500' : 'ring-gray-300'
                    } focus:ring-2 focus:ring-[#${PrimaryColor}]`}
                    placeholder="e.g., 12A1"
                  />
                </div>
                {formErrors.studentClass && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.studentClass}</p>
                )}
              </div>
            </div>
          );
        } else {
          return (
            <div className="text-center p-6">
              <p className="text-red-500">Please go back and select your role.</p>
            </div>
          );
        }
      
      case 4:
        return (
          <div className="text-center p-6 space-y-4">
            <CheckCircleIcon className={`h-12 w-12 mx-auto text-[#${PrimaryColor}]`} />
            <h4 className={`text-xl font-bold text-[#${SecondaryColor}]`}>Confirm Information!</h4>
            <p className="text-gray-600">
              You have completed the registration steps. Please click <strong>Complete</strong> to verify your email and start using StreamLand.
            </p>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={closeModal}>
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
              <Dialog.Panel className={`w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-8 text-left align-middle shadow-2xl transition-all border-t-8 border-[#${PrimaryColor}]`}>
                
                {/* Header */}
                <Dialog.Title
                  as="h3"
                  className={`text-2xl font-extrabold leading-6 text-[#${SecondaryColor}] flex items-center gap-2 mb-4`}
                >
                  <AcademicCapIcon className={`h-6 w-6 text-[#${PrimaryColor}]`} />
                  Sign Up for StreamLand
                </Dialog.Title>
                
                {/* Progress Bar */}
                <ProgressIndicator currentStep={currentStep} />
                
                {/* Nội dung theo bước */}
                <div className="mt-6 min-h-[200px] transition-opacity duration-300">
                  {renderStepContent()}
                </div>

                {/* Navigation Buttons */}
                <div className="mt-6 flex justify-between gap-4">
                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={currentStep === 1 || isSubmitting}
                    className={`rounded-lg px-4 py-2.5 text-base font-semibold transition duration-150 ${
                      currentStep === 1 || isSubmitting
                        ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                        : `text-[#${SecondaryColor}] hover:bg-gray-100`
                    }`}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={isSubmitting}
                    className={`flex items-center rounded-lg px-4 py-2.5 text-base font-semibold shadow-md transition duration-150 ${
                      currentStep === steps.length
                        ? `bg-white text-[#${PrimaryColor}] border-2 border-[#${PrimaryColor}] hover:bg-gray-50`
                        : `bg-[#${SecondaryColor}] text-white hover:bg-opacity-90`
                    } ${isSubmitting ? 'opacity-75 cursor-not-allowed' : ''}`}
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : currentStep < steps.length ? (
                      <>
                        Continue 
                        <ArrowRightIcon className="ml-2 h-5 w-5" />
                      </>
                    ) : 'Complete'}
                  </button>
                </div>
                
                {/* Footer */}
                <div className="mt-6 text-center text-sm">
                  <p className="text-gray-500">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => { closeModal(); openLoginModal(); }}
                      className={`font-semibold text-[#${SecondaryColor}] hover:text-opacity-80 transition duration-150`}
                    >
                      Sign In
                    </button>
                  </p>
                </div>

              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

// CheckCircleIcon đã được thêm vào import ở đầu file