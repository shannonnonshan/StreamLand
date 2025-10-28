"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Shield, 
  Mail, 
  Phone, 
  MapPin, 
  User, 
  Eye, 
  EyeOff,
  Save,
  Key,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ArrowLeft
} from "lucide-react";

export default function SettingsPage() {
  const params = useParams();
  const router = useRouter();
  const teacherId = params?.id as string;

  const [openSections, setOpenSections] = useState({
    security: false,
    personal: false,
  });

  const [settings, setSettings] = useState({
    email: "teacher@example.com",
    phone: "+84 123 456 789",
    address: "123 Main Street, Hanoi, Vietnam",
    gender: "male" as "male" | "female" | "other",
    substantiate: "PhD in Computer Science",
    yearOfWorking: 10,
    twoFactorEnabled: false,
  });

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

  const handleSaveSettings = () => {
    alert("Settings saved successfully!");
  };

  const handleChangePassword = () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert("New passwords do not match!");
      return;
    }
    alert("Password changed successfully!");
    setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
  };

  const handleToggle2FA = () => {
    setSettings({ ...settings, twoFactorEnabled: !settings.twoFactorEnabled });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
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
                        <Phone size={16} className="text-[#292C6D]" />
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={settings.phone}
                        onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#292C6D] focus:border-transparent text-gray-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="flex text-sm font-medium text-gray-700 mb-2 items-center gap-2">
                      <MapPin size={16} className="text-[#292C6D]" />
                      Address
                    </label>
                    <input
                      type="text"
                      value={settings.address}
                      onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#292C6D] focus:border-transparent text-gray-900"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                      <select
                        value={settings.gender}
                        onChange={(e) => setSettings({ ...settings, gender: e.target.value as "male" | "female" | "other" })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#292C6D] focus:border-transparent text-gray-900"
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Years of Experience</label>
                      <input
                        type="number"
                        value={settings.yearOfWorking}
                        onChange={(e) => setSettings({ ...settings, yearOfWorking: parseInt(e.target.value) })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#292C6D] focus:border-transparent text-gray-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Credentials / Substantiate</label>
                    <textarea
                      value={settings.substantiate}
                      onChange={(e) => setSettings({ ...settings, substantiate: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#292C6D] focus:border-transparent text-gray-900"
                      placeholder="e.g., PhD in Computer Science, 10 years teaching experience..."
                    />
                  </div>

                  <button
                    onClick={handleSaveSettings}
                    className="flex items-center gap-2 px-6 py-2 bg-[#292C6D] text-white rounded-lg hover:bg-[#1f2350] transition-colors"
                  >
                    <Save size={18} />
                    Save Changes
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
