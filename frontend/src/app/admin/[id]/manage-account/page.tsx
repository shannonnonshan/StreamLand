"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X, Info, Eye, EyeOff, ChevronLeft, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

enum EGender {
  MALE = "MALE",
  FEMALE = "FEMALE",
  OTHER = "OTHER",
}

interface AdminFormData {
  name: string;
  username: string;
  password?: string;
  confirmPassword?: string;
  email: string;
  address: string;
  phone: string;
  gender: EGender;
}
interface Admin {
  id: string;
  username: string;
  name: string;
  email?: string;
  address?: string;
  phone?: string;
  gender?: EGender;
  avatar?: string;
  status: "online" | "offline";
}

interface Teacher {
  id: string;
  username: string;
  name: string;
  avatar?: string;
  submitDate: string;
  reviewDate: string;
  details: string;
  status: "waiting" | "require-update" | "approved";
}

const defaultLogoUrl = "/logo.png";

export default function ManageAccount() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [loadingTeachers, setLoadingTeachers] = useState(true);

  const [dialogMode, setDialogMode] = useState<"create" | "update">("create");
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [adminPage, setAdminPage] = useState(1);
  const [teacherPage, setTeacherPage] = useState(1);
  const [adminSort, setAdminSort] = useState<'asc' | 'desc'>('asc');
  const [teacherSort, setTeacherSort] = useState<'asc' | 'desc'>('asc');
  const [adminSearch, setAdminSearch] = useState('');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [adminStatusFilter, setAdminStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [teacherStatusFilter, setTeacherStatusFilter] = useState<'all' | 'waiting' | 'require-update' | 'approved'>('all');
  const itemsPerPage = 5;


  // --- MOCK FETCH ---
  useEffect(() => {
    setLoadingAdmins(true);
    setTimeout(() => {
      setAdmins([
        { id: "1", username: "admin_anna", name: "Anna Smith", status: "online", gender: EGender.FEMALE },
        { id: "2", username: "admin_john", name: "John Doe", status: "offline", gender: EGender.MALE },
        { id: "3", username: "admin_sarah", name: "Sarah Johnson", status: "online", gender: EGender.FEMALE },
        { id: "4", username: "admin_michael", name: "Michael Brown", status: "offline", gender: EGender.MALE },
        { id: "5", username: "admin_emma", name: "Emma Davis", status: "online", gender: EGender.FEMALE },
        { id: "6", username: "admin_james", name: "James Wilson", status: "online", gender: EGender.MALE },
        { id: "7", username: "admin_lisa", name: "Lisa Anderson", status: "offline", gender: EGender.FEMALE },
        { id: "8", username: "admin_robert", name: "Robert Taylor", status: "online", gender: EGender.MALE },
        { id: "9", username: "admin_olivia", name: "Olivia White", status: "offline", gender: EGender.FEMALE },
        { id: "10", username: "admin_william", name: "William Moore", status: "online", gender: EGender.MALE },
        { id: "11", username: "admin_sophia", name: "Sophia Martinez", status: "online", gender: EGender.FEMALE },
        { id: "12", username: "admin_daniel", name: "Daniel Lee", status: "offline", gender: EGender.MALE }
      ]);
      setLoadingAdmins(false);
    }, 400);

    setLoadingTeachers(true);
    setTimeout(() => {
      setTeachers([
        {
          id: "1",
          username: "teacher_maria",
          name: "Maria Garcia",
          submitDate: "2025-10-20",
          reviewDate: "2025-10-25",
          details: "5 years experience, Mathematics",
          status: "waiting",
        },
        {
          id: "2",
          username: "teacher_david",
          name: "David Wilson",
          submitDate: "2025-10-22",
          reviewDate: "2025-10-25",
          details: "3 years experience, Physics",
          status: "approved",
        },
        {
          id: "3",
          username: "teacher_emily",
          name: "Emily Johnson",
          submitDate: "2025-10-23",
          reviewDate: "2025-10-26",
          details: "4 years experience, Biology",
          status: "waiting",
        },
        {
          id: "4",
          username: "teacher_alex",
          name: "Alex Thompson",
          submitDate: "2025-10-21",
          reviewDate: "2025-10-24",
          details: "6 years experience, Chemistry",
          status: "require-update",
        },
        {
          id: "5",
          username: "teacher_sarah",
          name: "Sarah Anderson",
          submitDate: "2025-10-19",
          reviewDate: "2025-10-23",
          details: "7 years experience, English",
          status: "approved",
        },
        {
          id: "6",
          username: "teacher_michael",
          name: "Michael Brown",
          submitDate: "2025-10-24",
          reviewDate: "2025-10-26",
          details: "3 years experience, History",
          status: "waiting",
        },
        {
          id: "7",
          username: "teacher_jennifer",
          name: "Jennifer Davis",
          submitDate: "2025-10-22",
          reviewDate: "2025-10-25",
          details: "5 years experience, Art",
          status: "require-update",
        },
        {
          id: "8",
          username: "teacher_robert",
          name: "Robert Wilson",
          submitDate: "2025-10-21",
          reviewDate: "2025-10-24",
          details: "4 years experience, Music",
          status: "waiting",
        }
      ]);
      setLoadingTeachers(false);
    }, 400);
  }, []);

  // Filter and sort admins
  const filteredAdmins = admins.filter(admin => {
    const matchesSearch = admin.username.toLowerCase().includes(adminSearch.toLowerCase()) ||
                         admin.name.toLowerCase().includes(adminSearch.toLowerCase());
    const matchesStatus = adminStatusFilter === 'all' || admin.status === adminStatusFilter;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    if (adminSort === 'asc') {
      return a.username.localeCompare(b.username);
    } else {
      return b.username.localeCompare(a.username);
    }
  });

  // Filter and sort teachers
  const filteredTeachers = teachers.filter(teacher => {
    const matchesSearch = teacher.username.toLowerCase().includes(teacherSearch.toLowerCase()) ||
                         teacher.name.toLowerCase().includes(teacherSearch.toLowerCase());
    const matchesStatus = teacherStatusFilter === 'all' || teacher.status === teacherStatusFilter;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    if (teacherSort === 'asc') {
      return a.username.localeCompare(b.username);
    } else {
      return b.username.localeCompare(a.username);
    }
  });

  const totalAdminPages = Math.ceil(filteredAdmins.length / itemsPerPage);
  const totalTeacherPages = Math.ceil(filteredTeachers.length / itemsPerPage);

  const paginatedAdmins = filteredAdmins.slice(
    (adminPage - 1) * itemsPerPage,
    adminPage * itemsPerPage
  );
  const paginatedTeachers = filteredTeachers.slice(
    (teacherPage - 1) * itemsPerPage,
    teacherPage * itemsPerPage
  );
  // --- CRUD HANDLERS ---
  const handleCreateAdmin = (data: AdminFormData) => {
    const newAdmin: Admin = {
      id: Date.now().toString(),
      username: data.username,
      name: data.name,
      email: data.email,
      address: data.address,
      phone: data.phone,
      gender: data.gender,
      status: "offline",
    };
    setAdmins((prev) => [...prev, newAdmin]);
  };

  const handleUpdateAdmin = (data: AdminFormData) => {
    if (!selectedAdmin) return;
    setAdmins((prev) =>
      prev.map((a) => (a.id === selectedAdmin.id ? { ...a, ...data } : a))
    );
  };

  const handleDeleteAdmin = (id: string) => {
    setAdmins((prev) => prev.filter((a) => a.id !== id));
  };

  const handleApproveTeacher = (id: string) => {
    setTeachers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "approved" } : t))
    );
  };

  return (
    <div className="p-8 space-y-10">
      <h1 className="text-2xl font-bold text-[#161853]">Manage Account</h1>

      {/* --- ADMIN TABLE --- */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-[#161853]">Administrators</h2>

          <button
            onClick={() => {
              setDialogMode("create");
              setSelectedAdmin(null);
              setIsFormOpen(true);
            }}
            className="bg-[#FFD93D] text-[#161853] hover:bg-[#ffc90f] px-4 py-2 rounded-md font-medium"
          >
            ADD ADMIN
          </button>
        </div>

        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name or username..."
              value={adminSearch}
              onChange={(e) => {
                setAdminSearch(e.target.value);
                setAdminPage(1); // Reset to first page on search
              }}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
          <select
            value={adminStatusFilter}
            onChange={(e) => {
              setAdminStatusFilter(e.target.value as 'all' | 'online' | 'offline');
              setAdminPage(1); // Reset to first page on filter change
            }}
            className="border rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All Status</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
          <button
            onClick={() => setAdminSort(current => current === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-2 border rounded-md text-sm hover:bg-gray-50"
          >
            Sort by ID {adminSort === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="text-left border-b">
              <tr>
                <th className="pb-3">Admin</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loadingAdmins ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                    Loading administrators...
                  </td>
                </tr>
              ) : (
                paginatedAdmins.map((a) => (
                  <tr key={a.id}>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#161853] rounded-full overflow-hidden flex items-center justify-center">
                          <Image
                            src={a.avatar || defaultLogoUrl}
                            alt={a.name}
                            width={40}
                            height={40}
                            className="object-cover"
                          />
                        </div>
                        <div>
                          <div className="font-medium">{a.username}</div>
                          <div className="text-sm text-gray-500">{a.name}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className={clsx(
                          "px-2 py-1 rounded-full text-sm capitalize",
                          a.status === "online"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-700"
                        )}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="text-right space-x-2">
                      <button
                        onClick={() => {
                          setDialogMode("update");
                          setSelectedAdmin(a);
                          setIsFormOpen(true);
                        }}
                        className="px-3 py-1.5 border rounded-md text-sm hover:bg-gray-50"
                      >
                        Update
                      </button>

                      <button
                        onClick={() => {
                          setSelectedAdmin(a);
                          setIsDeleteOpen(true);
                        }}
                        className="px-3 py-1.5 border rounded-md text-sm text-red-500 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Admin Pagination */}
        {!loadingAdmins && admins.length > 0 && (
          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <div className="text-sm text-gray-500">
              Showing {((adminPage - 1) * itemsPerPage) + 1} to {Math.min(adminPage * itemsPerPage, admins.length)} of {admins.length} administrators
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setAdminPage(p => Math.max(1, p - 1))}
                disabled={adminPage === 1}
                className="p-2 rounded-md border text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setAdminPage(p => Math.min(totalAdminPages, p + 1))}
                disabled={adminPage === totalAdminPages}
                className="p-2 rounded-md border text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- TEACHER TABLE --- */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#161853] mb-6">
          Waiting-approved Teachers
        </h2>

        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name or username..."
              value={teacherSearch}
              onChange={(e) => {
                setTeacherSearch(e.target.value);
                setTeacherPage(1); // Reset to first page on search
              }}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
          <select
            value={teacherStatusFilter}
            onChange={(e) => {
              setTeacherStatusFilter(e.target.value as 'all' | 'waiting' | 'require-update' | 'approved');
              setTeacherPage(1); // Reset to first page on filter change
            }}
            className="border rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All Status</option>
            <option value="waiting">Waiting</option>
            <option value="require-update">Require Update</option>
            <option value="approved">Approved</option>
          </select>
          <button
            onClick={() => setTeacherSort(current => current === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-2 border rounded-md text-sm hover:bg-gray-50"
          >
            Sort by ID {teacherSort === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="text-left border-b">
              <tr>
                <th className="pb-3">Teacher</th>
                <th className="pb-3">Submit Date</th>
                <th className="pb-3">Review Date</th>
                <th className="pb-3">Details</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loadingTeachers ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                    Loading teachers...
                  </td>
                </tr>
              ) : (
                paginatedTeachers.map((t) => (
                  <tr key={t.id}>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#161853] rounded-full overflow-hidden flex items-center justify-center">
                          <Image
                            src={t.avatar || defaultLogoUrl}
                            alt={t.name}
                            width={40}
                            height={40}
                            className="object-cover"
                          />
                        </div>
                        <div>
                          <div className="font-medium">{t.username}</div>
                          <div className="text-sm text-gray-500">{t.name}</div>
                        </div>
                      </div>
                    </td>
                    <td>{t.submitDate}</td>
                    <td>{t.reviewDate}</td>
                    <td>
                      <button className="text-blue-500 hover:text-blue-700 text-sm flex items-center gap-1">
                        <Info className="w-4 h-4" /> details
                      </button>
                    </td>
                    <td>
                      <span
                        className={clsx(
                          "px-2 py-1 rounded-full text-sm capitalize",
                          t.status === "waiting"
                            ? "bg-yellow-100 text-yellow-700"
                            : t.status === "require-update"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-green-100 text-green-700"
                        )}
                      >
                        {t.status.replace("-", " ")}
                      </span>
                    </td>
                    <td className="text-right">
                      {t.status === "waiting" && (
                        <button
                          onClick={() => handleApproveTeacher(t.id)}
                          className="px-3 py-1.5 bg-[#EC255A] hover:bg-[#d61e4e] text-white rounded-md text-sm"
                        >
                          Approve
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Teacher Pagination */}
        {!loadingTeachers && teachers.length > 0 && (
          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <div className="text-sm text-gray-500">
              Showing {((teacherPage - 1) * itemsPerPage) + 1} to {Math.min(teacherPage * itemsPerPage, teachers.length)} of {teachers.length} teachers
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setTeacherPage(p => Math.max(1, p - 1))}
                disabled={teacherPage === 1}
                className="p-2 rounded-md border text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTeacherPage(p => Math.min(totalTeacherPages, p + 1))}
                disabled={teacherPage === totalTeacherPages}
                className="p-2 rounded-md border text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- DIALOG FORM (ADD / UPDATE) --- */}
      <AdminFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        mode={dialogMode}
        defaultData={selectedAdmin}
        onSubmit={(data) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          dialogMode === "create"
            ? handleCreateAdmin(data)
            : handleUpdateAdmin(data);
        }}
      />

      {/* --- DELETE CONFIRMATION --- */}
      <Dialog.Root open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 w-[90vw] max-w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg">
            <Dialog.Title className="text-lg font-semibold text-[#161853] mb-4">
              Confirm Deletion
            </Dialog.Title>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete{" "}
              <span className="font-medium">{selectedAdmin?.name}</span>? This
              action cannot be undone.
            </p>

            <div className="flex justify-end space-x-2">
              <Dialog.Close className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-800">
                Cancel
              </Dialog.Close>
              <Dialog.Close
                asChild
                onClick={() => {
                  if (selectedAdmin) handleDeleteAdmin(selectedAdmin.id);
                }}
              >
                <button className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600">
                  Delete
                </button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

/* ------------------- REUSABLE DIALOG FORM ------------------- */
export function AdminFormDialog({
  open,
  onOpenChange,
  mode,
  defaultData,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "create" | "update";
  defaultData?: Admin | null;
  onSubmit: (data: AdminFormData) => void;
}) {
  const [formData, setFormData] = useState<AdminFormData>({
    name: "",
    username: "",
    password: "",
    confirmPassword: "",
    email: "",
    address: "",
    phone: "",
    gender: EGender.MALE,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof AdminFormData, string>>
  >({});

  useEffect(() => {
    if (mode === "update" && defaultData) {
      setFormData({
        name: defaultData.name,
        username: defaultData.username,
        password: "",
        confirmPassword: "",
        email: defaultData.email || "",
        address: defaultData.address || "",
        phone: defaultData.phone || "",
        gender: defaultData.gender || EGender.MALE,
      });
    } else {
      setFormData({
        name: "",
        username: "",
        password: "",
        confirmPassword: "",
        email: "",
        address: "",
        phone: "",
        gender: EGender.MALE,
      });
    }
  }, [mode, defaultData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const errors: Partial<Record<keyof AdminFormData, string>> = {};

    if (!formData.name?.trim()) errors.name = "Name is required";
    if (!formData.username?.trim()) errors.username = "Username is required";
    if (!formData.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      errors.email = "Valid email is required";
    if (!formData.address?.trim()) errors.address = "Address is required";
    if (!formData.phone?.trim()) errors.phone = "Phone number is required";
    if (!formData.gender) errors.gender = "Gender is required";

    if (mode === "create") {
      if (!formData.password?.trim()) {
        errors.password = "Password is required";
      } else if (formData.password.length < 8) {
        errors.password = "Password must be at least 8 characters";
      }

      if (!formData.confirmPassword?.trim()) {
        errors.confirmPassword = "Please confirm password";
      } else if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = "Passwords do not match";
      }
    } else if (mode === "update" && formData.password?.trim()) {
      if (formData.password.length < 8)
        errors.password = "Password must be at least 8 characters";
      if (formData.password !== formData.confirmPassword)
        errors.confirmPassword = "Passwords do not match";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setIsSubmitting(false);
      return;
    }

    setFormErrors({});
    setTimeout(() => {
      onSubmit(formData);
      setIsSubmitting(false);
      onOpenChange(false);
    }, 500);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 w-[90vw] max-w-[450px]
          -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 
          shadow-lg overflow-y-auto max-h-[80vh]"
        >
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold text-[#161853]">
              {mode === "create" ? "Add New Admin" : "Update Admin"}
            </Dialog.Title>
            <Dialog.Close className="rounded-full p-1.5 hover:bg-gray-100">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              ["name", "Full Name"],
              ["username", "Username"],
              ["email", "Email"],
              ["address", "Address"],
              ["phone", "Phone Number"],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700">
                  {label}
                </label>
                <input
                  name={key}
                  type="text"
                  value={formData[key as keyof AdminFormData] as string}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, [key]: e.target.value }))
                  }
                  className={`block w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors
                    ${
                      formErrors[key as keyof AdminFormData]
                        ? "border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        : "border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    }`}
                />
                {formErrors[key as keyof AdminFormData] && (
                  <p className="text-sm text-red-500 mt-1">
                    {formErrors[key as keyof AdminFormData]}
                  </p>
                )}
              </div>
            ))}

            {/* Password fields */}
            {(mode === "create" || mode === "update") && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Password {mode === "update" && "(optional)"}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, password: e.target.value }))
                      }
                      className={`block w-full rounded-md border px-3 py-2 text-sm outline-none pr-10 ${
                        formErrors.password
                          ? "border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                          : "border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {formErrors.password && (
                    <p className="text-sm text-red-500 mt-1">
                      {formErrors.password}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          confirmPassword: e.target.value,
                        }))
                      }
                      className={`block w-full rounded-md border px-3 py-2 text-sm outline-none pr-10 ${
                        formErrors.confirmPassword
                          ? "border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                          : "border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
                    >
                      {showConfirm ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {formErrors.confirmPassword && (
                    <p className="text-sm text-red-500 mt-1">
                      {formErrors.confirmPassword}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Gender */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Gender
              </label>
              <select
                value={formData.gender}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    gender: e.target.value as EGender,
                  }))
                }
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value={EGender.MALE}>Male</option>
                <option value={EGender.FEMALE}>Female</option>
                <option value={EGender.OTHER}>Other</option>
              </select>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Dialog.Close className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-800">
                Cancel
              </Dialog.Close>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-[#161853] px-4 py-2 text-sm font-medium text-white hover:bg-[#0f1038] disabled:bg-gray-400 flex items-center space-x-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>
                  {isSubmitting
                    ? "Saving..."
                    : mode === "create"
                    ? "Create Admin"
                    : "Update Admin"}
                </span>
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
