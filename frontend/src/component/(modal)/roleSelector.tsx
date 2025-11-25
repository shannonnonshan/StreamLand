import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { AcademicCapIcon, UserGroupIcon, XMarkIcon } from '@heroicons/react/24/outline';

const PrimaryColor = '161853';

type RoleSelectorModalProps = {
  isOpen: boolean;
  closeModal: () => void;
  onSelectRole: (role: 'STUDENT' | 'TEACHER') => void;
  provider: 'google' | 'github';
};

export default function RoleSelectorModal({ isOpen, closeModal, onSelectRole, provider }: RoleSelectorModalProps) {
  const providerName = provider === 'google' ? 'Google' : 'GitHub';
  
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
              <Dialog.Panel className={`w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-8 text-left align-middle shadow-2xl transition-all border-t-4 border-[#${PrimaryColor}]`}>
                
                {/* Close Button */}
                <button
                  onClick={closeModal}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>

                {/* Header */}
                <Dialog.Title
                  as="h3"
                  className={`text-2xl font-extrabold leading-6 text-[#${PrimaryColor}] mb-2`}
                >
                  Choose Your Role
                </Dialog.Title>
                <p className="text-sm text-gray-600 mb-8">
                  Do you want to sign in with {providerName} as a Student or Teacher?
                </p>

                {/* Role Options */}
                <div className="space-y-4">
                  {/* Student Option */}
                  <button
                    onClick={() => onSelectRole('STUDENT')}
                    className="group w-full flex items-center gap-4 p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all duration-200"
                  >
                    <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <AcademicCapIcon className="h-8 w-8 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <h4 className="text-lg font-bold text-gray-900 group-hover:text-blue-600">
                        Student
                      </h4>
                      <p className="text-sm text-gray-600">
                        Join courses, watch livestreams and learn
                      </p>
                    </div>
                  </button>

                  {/* Teacher Option */}
                  <button
                    onClick={() => onSelectRole('TEACHER')}
                    className="group w-full flex items-center gap-4 p-6 border-2 border-gray-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all duration-200"
                  >
                    <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <UserGroupIcon className="h-8 w-8 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <h4 className="text-lg font-bold text-gray-900 group-hover:text-purple-600">
                        Teacher
                      </h4>
                      <p className="text-sm text-gray-600">
                        Create courses, livestream and teach
                      </p>
                    </div>
                  </button>
                </div>

                {/* Cancel Button */}
                <button
                  onClick={closeModal}
                  className="mt-6 w-full py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Hủy bỏ
                </button>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
