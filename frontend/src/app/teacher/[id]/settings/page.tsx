"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import toast, { Toaster } from 'react-hot-toast';
import { 
  Shield, 
  Mail, 
  MapPin, 
  User, 
  Eye, 
  EyeOff,
  Save,
  Key,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Camera,
  Upload,
  FileText,
  Download,
  Trash2
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const VIETNAM_PROVINCES = [
  "Tuyen Quang, Vietnam",
  "Lao Cai, Vietnam",
  "Thai Nguyen, Vietnam",
  "Phu Tho, Vietnam",
  "Bac Ninh, Vietnam",
  "Hung Yen, Vietnam",
  "Ha Phong, Vietnam",
  "Ninh Binh, Vietnam",
  "Quang Tri, Vietnam",
  "Da Nang, Vietnam",
  "Quang Ngai, Vietnam",
  "Gia Lai, Vietnam",
  "Khanh Hoa, Vietnam",
  "Lam Dong, Vietnam",
  "Dak Lak, Vietnam",
  "Ho Chi Minh, Vietnam",
  "Dong Nai, Vietnam",
  "Tay Ninh, Vietnam",
  "Can Tho, Vietnam",
  "Vinh Long, Vietnam",
  "Dong Thap, Vietnam",
  "Ca Mau, Vietnam",
  "An Giang, Vietnam",
  "Ha Noi, Vietnam",
  "Hue, Vietnam",
  "Nghe An, Vietnam",
  "Ha Tinh, Vietnam",
  "Thanh Hoa, Vietnam",
  "Nam Dinh, Vietnam",
  "Hai Duong, Vietnam",
  "Hung Yen, Vietnam",
  "Hai Phong, Vietnam",
  "Quang Ninh, Vietnam",
  "Ha Giang, Vietnam",
];

export default function SettingsPage() {
  const params = useParams();
  const router = useRouter();
  const { getProfile } = useAuth();
  const teacherId = params?.id as string;

  const [openSections, setOpenSections] = useState({
    security: false,
    personal: false,
  });

  const [settings, setSettings] = useState({
    email: "",
    fullName: "",
    bio: "",
    location: "",
    education: "",
    experience: 0,
    website: "",
    linkedin: "",
    twoFactorEnabled: false,
    avatar: "",
    cvUrl: "",
    subjects: [] as string[],
  });

  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCV, setUploadingCV] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchTeacherData = async () => {
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
        const response = await fetch(`${API_URL}/teacher/${teacherId}/profile`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        
        if (response.ok) {
          const data = await response.json();
          setSettings({
            email: data.email || '',
            fullName: data.fullName || '',
            bio: data.bio || '',
            location: data.location || '',
            education: data.teacherProfile?.education || '',
            experience: data.teacherProfile?.experience || 0,
            website: data.teacherProfile?.website || '',
            linkedin: data.teacherProfile?.linkedin || '',
            twoFactorEnabled: data.twoFactorEnabled || false,
            avatar: data.avatar || '',
            cvUrl: data.teacherProfile?.cvUrl || '',
            subjects: data.teacherProfile?.subjects || [],
          });
          if (data.avatar) {
            setAvatarPreview(data.avatar);
          }
        }
      } catch (error) {
        console.error('Error fetching teacher data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTeacherData();
  }, [teacherId]);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const toggleSection = (section: "security" | "personal") => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSaveSettings = async () => {
    if (saving) return;
    
    setSaving(true);
    
    // Show loading toast with spinner
    const loadingToastId = toast.loading('Saving settings...', {
      position: 'top-right',
      style: {
        background: '#047e56ff',
        color: '#fff',
        padding: '16px',
        borderRadius: '8px',
      },
    });
    
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      
      // Execute both API calls in parallel for faster response
      const [userProfileResponse, teacherProfileResponse] = await Promise.all([
        fetch(`${API_URL}/auth/profile`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            fullName: settings.fullName,
            bio: settings.bio,
            location: settings.location,
          }),
        }),
        fetch(`${API_URL}/auth/profile/teacher`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            education: settings.education,
            experience: settings.experience,
            website: settings.website,
            linkedin: settings.linkedin,
          }),
        }),
      ]);

      if (userProfileResponse.ok && teacherProfileResponse.ok) {
        // Refresh user profile to update Headerbar
        await getProfile();
        
        // Dismiss loading toast and show success with checkmark
        toast.dismiss(loadingToastId);
        toast.success('Settings saved successfully!', {
          duration: 3000,
          position: 'top-right',
          icon: '✓',
          style: {
            background: '#047e56ff',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
            fontWeight: '500',
          },
        });
      } else {
        toast.dismiss(loadingToastId);
        const errorMsg = !userProfileResponse.ok 
          ? 'Failed to save user profile' 
          : 'Failed to save teacher profile';
        toast.error(errorMsg, {
          duration: 4000,
          position: 'top-right',
          icon: '✕',
          style: {
            background: '#EF4444',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
          },
        });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.dismiss(loadingToastId);
      toast.error('Error saving settings', {
        duration: 4000,
        position: 'top-right',
        icon: '✕',
        style: {
          background: '#EF4444',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
        },
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match!', {
        duration: 4000,
        position: 'top-right',
        icon: '✕',
        style: {
          background: '#EF4444',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
        },
      });
      return;
    }

    const loadingToastId = toast.loading('Changing password...', {
      position: 'top-right',
      style: {
        background: '#292C6D',
        color: '#fff',
        padding: '16px',
        borderRadius: '8px',
      },
    });

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/teacher/${teacherId}/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      if (response.ok) {
        toast.dismiss(loadingToastId);
        toast.success('Password changed successfully!', {
          duration: 3000,
          position: 'top-right',
          icon: '✓',
          style: {
            background: '#10B981',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
            fontWeight: '500',
          },
        });
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        toast.dismiss(loadingToastId);
        toast.error('Failed to change password', {
          duration: 4000,
          position: 'top-right',
          icon: '✕',
          style: {
            background: '#EF4444',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
          },
        });
      }
    } catch (error) {
      console.error('Error changing password:', error);
      toast.dismiss(loadingToastId);
      toast.error('Error changing password', {
        duration: 4000,
        position: 'top-right',
        icon: '✕',
        style: {
          background: '#EF4444',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
        },
      });
    }
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Preview image
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      // Upload immediately
      handleAvatarUpload(file);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    setUploadingAvatar(true);
    const loadingToastId = toast.loading('Uploading avatar...', {
      position: 'top-right',
      style: {
        background: '#047e56ff',
        color: '#fff',
        padding: '16px',
        borderRadius: '8px',
      },
    });

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch(`${API_URL}/auth/profile`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        toast.dismiss(loadingToastId);
        toast.success('Avatar updated successfully!', {
          duration: 3000,
          position: 'top-right',
          icon: '✓',
          style: {
            background: '#047e56ff',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
            fontWeight: '500',
          },
        });
        
        // Refresh profile
        await getProfile();
      } else {
        toast.dismiss(loadingToastId);
        toast.error('Failed to upload avatar', {
          duration: 4000,
          position: 'top-right',
          icon: '✕',
          style: {
            background: '#EF4444',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
          },
        });
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.dismiss(loadingToastId);
      toast.error('Error uploading avatar', {
        duration: 4000,
        position: 'top-right',
        icon: '✕',
        style: {
          background: '#EF4444',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
        },
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleToggle2FA = async () => {
    const newValue = !settings.twoFactorEnabled;
    const loadingToastId = toast.loading(`${newValue ? 'Enabling' : 'Disabling'} 2FA...`, {
      position: 'top-right',
      style: {
        background: '#292C6D',
        color: '#fff',
        padding: '16px',
        borderRadius: '8px',
      },
    });

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      
      const response = await fetch(`${API_URL}/auth/${teacherId}/2fa`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ twoFactorEnabled: newValue }),
      });

      if (response.ok) {
        setSettings({ ...settings, twoFactorEnabled: newValue });
        toast.dismiss(loadingToastId);
        toast.success(`2FA ${newValue ? 'enabled' : 'disabled'} successfully!`, {
          duration: 3000,
          position: 'top-right',
          icon: '✓',
          style: {
            background: '#10B981',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
            fontWeight: '500',
          },
        });
      } else {
        toast.dismiss(loadingToastId);
        toast.error('Failed to toggle 2FA', {
          duration: 4000,
          position: 'top-right',
          icon: '✕',
          style: {
            background: '#EF4444',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
          },
        });
      }
    } catch (error) {
      console.error('Error toggling 2FA:', error);
      toast.dismiss(loadingToastId);
      toast.error('Error toggling 2FA', {
        duration: 4000,
        position: 'top-right',
        icon: '✕',
        style: {
          background: '#EF4444',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
        },
      });
    }
  };

  const handleCVSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.includes('pdf') && !file.name.endsWith('.pdf')) {
        toast.error('Please upload a PDF file', {
          duration: 4000,
          position: 'top-right',
          icon: '✕',
          style: {
            background: '#EF4444',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
          },
        });
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB', {
          duration: 4000,
          position: 'top-right',
          icon: '✕',
          style: {
            background: '#EF4444',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
          },
        });
        return;
      }

      handleCVUpload(file);
    }
  };

  const handleCVUpload = async (file: File) => {
    setUploadingCV(true);
    const loadingToastId = toast.loading('Uploading CV...', {
      position: 'top-right',
      style: {
        background: '#047e56ff',
        color: '#fff',
        padding: '16px',
        borderRadius: '8px',
      },
    });

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      const formData = new FormData();
      formData.append('cv', file);

      const response = await fetch(`${API_URL}/auth/profile/teacher/upload-cv`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setSettings({
          ...settings,
          cvUrl: data.teacherProfile?.cvUrl || '',
        });

        toast.dismiss(loadingToastId);
        toast.success('CV uploaded successfully!', {
          duration: 3000,
          position: 'top-right',
          icon: '✓',
          style: {
            background: '#047e56ff',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
            fontWeight: '500',
          },
        });
      } else {
        toast.dismiss(loadingToastId);
        toast.error('Failed to upload CV', {
          duration: 4000,
          position: 'top-right',
          icon: '✕',
          style: {
            background: '#EF4444',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
          },
        });
      }
    } catch (error) {
      console.error('Error uploading CV:', error);
      toast.dismiss(loadingToastId);
      toast.error('Error uploading CV', {
        duration: 4000,
        position: 'top-right',
        icon: '✕',
        style: {
          background: '#EF4444',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
        },
      });
    } finally {
      setUploadingCV(false);
    }
  };

  const handleDeleteCV = async () => {
    const confirmDelete = window.confirm('Are you sure you want to delete your CV?');
    if (!confirmDelete) return;

    const loadingToastId = toast.loading('Deleting CV...', {
      position: 'top-right',
      style: {
        background: '#EF4444',
        color: '#fff',
        padding: '16px',
        borderRadius: '8px',
      },
    });

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/auth/profile/teacher`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          cvUrl: null,
        }),
      });

      if (response.ok) {
        setSettings({ ...settings, cvUrl: '' });
        toast.dismiss(loadingToastId);
        toast.success('CV deleted successfully!', {
          duration: 3000,
          position: 'top-right',
          icon: '✓',
          style: {
            background: '#10B981',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
            fontWeight: '500',
          },
        });
      } else {
        toast.dismiss(loadingToastId);
        toast.error('Failed to delete CV', {
          duration: 4000,
          position: 'top-right',
          icon: '✕',
          style: {
            background: '#EF4444',
            color: '#fff',
            padding: '16px',
            borderRadius: '8px',
          },
        });
      }
    } catch (error) {
      console.error('Error deleting CV:', error);
      toast.dismiss(loadingToastId);
      toast.error('Error deleting CV', {
        duration: 4000,
        position: 'top-right',
        icon: '✕',
        style: {
          background: '#EF4444',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
        },
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <Toaster />
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Back</span>
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Account Settings</h1>
          <p className="text-gray-600">Manage your account security and privacy settings</p>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <button
              onClick={() => toggleSection("security")}
              className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#292C6D] rounded-lg flex items-center justify-center">
                  <Shield className="text-white" size={20} />
                </div>
                <div className="text-left">
                  <h2 className="text-xl font-semibold text-gray-900">Security</h2>
                  <p className="text-sm text-gray-500">Password and authentication settings</p>
                </div>
              </div>
              {openSections.security ? (
                <ChevronUp className="text-gray-400" size={24} />
              ) : (
                <ChevronDown className="text-gray-400" size={24} />
              )}
            </button>

            {openSections.security && (
              <div className="px-6 pb-6 border-t">
                <div className="mt-6 mb-6">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Key size={18} className="text-[#292C6D]" />
                    Change Password
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Current Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.current ? "text" : "password"}
                          value={passwordForm.currentPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#292C6D] focus:border-transparent text-gray-900"
                          placeholder="Enter current password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.new ? "text" : "password"}
                          value={passwordForm.newPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#292C6D] focus:border-transparent text-gray-900"
                          placeholder="Enter new password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords.confirm ? "text" : "password"}
                          value={passwordForm.confirmPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#292C6D] focus:border-transparent text-gray-900"
                          placeholder="Confirm new password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={handleChangePassword}
                      className="px-6 py-2 bg-[#292C6D] text-white rounded-lg hover:bg-[#1f2350] transition-colors"
                    >
                      Update Password
                    </button>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Two-Factor Authentication (2FA)</h3>
                      <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
                    </div>
                    <button
                      onClick={handleToggle2FA}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        settings.twoFactorEnabled ? "bg-[#292C6D]" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.twoFactorEnabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                  {settings.twoFactorEnabled && (
                    <div className="mt-4 p-4 bg-green-50 rounded-lg flex items-start gap-3">
                      <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                      <div>
                        <p className="text-sm font-medium text-green-900">2FA is enabled</p>
                        <p className="text-sm text-green-700">Your account is protected with two-factor authentication</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Avatar Section */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#047e56ff] rounded-lg flex items-center justify-center">
                  <Camera className="text-white" size={20} />
                </div>
                <div className="text-left">
                  <h2 className="text-xl font-semibold text-gray-900">Profile Picture</h2>
                  <p className="text-sm text-gray-500">Update your avatar</p>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 pt-6">
              <div className="flex flex-col items-center gap-6">
                {/* Avatar Preview */}
                <div className="relative">
                  <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border-4 border-gray-100 shadow-md">
                    {avatarPreview || settings.avatar ? (
                      <img
                        src={avatarPreview || settings.avatar}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User size={64} className="text-gray-400" />
                    )}
                  </div>
                  
                  {/* Upload Button Overlay */}
                  <label
                    htmlFor="avatar-input"
                    className="absolute bottom-0 right-0 bg-[#047e56ff] hover:bg-[#036644ff] text-white rounded-full p-3 cursor-pointer shadow-lg transition-colors"
                  >
                    <Upload size={20} />
                    <input
                      id="avatar-input"
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarSelect}
                      className="hidden"
                      disabled={uploadingAvatar}
                    />
                  </label>
                </div>

                {uploadingAvatar && (
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#047e56ff]"></div>
                    <p className="text-sm text-gray-600 mt-2">Uploading...</p>
                  </div>
                )}
                
                {!uploadingAvatar && (
                  <p className="text-sm text-gray-500 text-center">
                    Click the camera icon to upload a new avatar
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <button
              onClick={() => toggleSection("personal")}
              className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#292C6D] rounded-lg flex items-center justify-center">
                  <User className="text-white" size={20} />
                </div>
                <div className="text-left">
                  <h2 className="text-xl font-semibold text-gray-900">Personal Information</h2>
                  <p className="text-sm text-gray-500">Update your private contact details</p>
                </div>
              </div>
              {openSections.personal ? (
                <ChevronUp className="text-gray-400" size={24} />
              ) : (
                <ChevronDown className="text-gray-400" size={24} />
              )}
            </button>

            {openSections.personal && (
              <div className="px-6 pb-6 border-t">
                <div className="mt-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="flex text-sm font-medium text-gray-700 mb-2 items-center gap-2">
                        <Mail size={16} className="text-[#292C6D]" />
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={settings.email}
                        onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#292C6D] focus:border-transparent text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="flex text-sm font-medium text-gray-700 mb-2 items-center gap-2">
                        <User size={16} className="text-[#292C6D]" />
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={settings.fullName}
                        onChange={(e) => setSettings({ ...settings, fullName: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#292C6D] focus:border-transparent text-gray-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="flex text-sm font-medium text-gray-700 mb-2 items-center gap-2">
                      <MapPin size={16} className="text-[#292C6D]" />
                      Location
                    </label>
                    <select
                      value={settings.location}
                      onChange={(e) => setSettings({ ...settings, location: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#292C6D] focus:border-transparent text-gray-900 bg-white"
                    >
                      <option value="">Select a province or city</option>
                      {VIETNAM_PROVINCES.map((province) => (
                        <option key={province} value={province}>
                          {province}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                    <textarea
                      value={settings.bio}
                      onChange={(e) => setSettings({ ...settings, bio: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#292C6D] focus:border-transparent text-gray-900"
                      placeholder="Tell us about yourself..."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Education</label>
                      <input
                        type="text"
                        value={settings.education}
                        onChange={(e) => setSettings({ ...settings, education: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#292C6D] focus:border-transparent text-gray-900"
                        placeholder="e.g., PhD in Computer Science"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Years of Experience</label>
                      <input
                        type="number"
                        value={settings.experience}
                        onChange={(e) => setSettings({ ...settings, experience: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#292C6D] focus:border-transparent text-gray-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
                      <input
                        type="url"
                        value={settings.website}
                        onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#292C6D] focus:border-transparent text-gray-900"
                        placeholder="https://..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">LinkedIn</label>
                      <input
                        type="url"
                        value={settings.linkedin}
                        onChange={(e) => setSettings({ ...settings, linkedin: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#292C6D] focus:border-transparent text-gray-900"
                        placeholder="https://linkedin.com/in/..."
                      />
                    </div>
                  </div>

                  {/* CV Upload Section */}
                  <div className="border-t pt-6 mt-6">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <FileText size={18} className="text-blue-600" />
                      Curriculum Vitae (CV)
                    </h3>
                    
                    {/* Current CV Display */}
                    {settings.cvUrl && (
                      <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200 mb-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <FileText className="text-blue-600 flex-shrink-0 mt-1" size={24} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900">Your CV is uploaded</p>
                              <p className="text-sm text-gray-500 mt-1">Click to download or view</p>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <a
                              href={settings.cvUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                              title="Download CV"
                            >
                              <Download className="text-blue-600" size={20} />
                            </a>
                            <button
                              onClick={handleDeleteCV}
                              className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                              title="Delete CV"
                            >
                              <Trash2 className="text-red-600" size={20} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Upload Area */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        {settings.cvUrl ? 'Update CV' : 'Upload CV (PDF only, max 10MB)'}
                      </label>
                      <label
                        htmlFor="cv-input"
                        className={`flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                          uploadingCV
                            ? 'bg-gray-50 border-gray-300'
                            : 'bg-blue-50 border-blue-300 hover:bg-blue-100'
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center py-2">
                          {uploadingCV ? (
                            <>
                              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                              <p className="text-sm text-gray-600">Uploading...</p>
                            </>
                          ) : (
                            <>
                              <FileText className="text-blue-600 mb-2" size={32} />
                              <p className="text-sm font-medium text-gray-900">
                                Click to upload or drag and drop
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                PDF only, max 10MB
                              </p>
                            </>
                          )}
                        </div>
                        <input
                          id="cv-input"
                          type="file"
                          accept=".pdf"
                          onChange={handleCVSelect}
                          className="hidden"
                          disabled={uploadingCV}
                        />
                      </label>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className={`flex items-center gap-2 px-6 py-2 bg-[#292C6D] text-white rounded-lg transition-colors ${
                      saving 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:bg-[#1f2350]'
                    }`}
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={18} />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
