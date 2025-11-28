"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X, Info, Eye, EyeOff, ChevronLeft, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface AdminFormData {
  name: string;
  password?: string;
  confirmPassword?: string;
  email: string;
}
interface Admin {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: "online" | "offline";
}

interface Teacher {
  id: string;
  username: string;
  name: string;
  email: string;
  avatar?: string;
  submitDate: string;
  reviewDate: string;
  details: string;
  status: "waiting" | "require-update" | "approved";
  education?: string;
  experience?: number;
  subjects?: string[];
  cvUrl?: string;
  website?: string;
  linkedin?: string;
  bio?: string;
  location?: string;
}

const defaultLogoUrl = "/logo.png";

export default function ManageAccount() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [loadingTeachers, setLoadingTeachers] = useState(true);

  const [dialogMode, setDialogMode] = useState<"create" | "update">("create");
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isTeacherDetailsOpen, setIsTeacherDetailsOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const [adminPage, setAdminPage] = useState(1);
  const [teacherPage, setTeacherPage] = useState(1);
  const [adminSort, setAdminSort] = useState<'asc' | 'desc'>('asc');
  const [teacherSort, setTeacherSort] = useState<'asc' | 'desc'>('asc');
  const [adminSearch, setAdminSearch] = useState('');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [adminStatusFilter, setAdminStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [teacherStatusFilter, setTeacherStatusFilter] = useState<'all' | 'waiting' | 'require-update' | 'approved'>('all');
  const itemsPerPage = 5;


  // --- FETCH FROM BACKEND ---
  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

      // Fetch admins
      setLoadingAdmins(true);
      try {
        const response = await fetch(`${API_URL}/admin/users?role=ADMIN&limit=100`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          const mappedAdmins = data.users.map((user: any) => ({
            id: user.id,
            name: user.fullName,
            email: user.email,
            avatar: user.avatar,
            status: 'offline' as const, // Backend doesn't track online status yet
          }));
          setAdmins(mappedAdmins);
        }
      } catch (error) {
        console.error('Error fetching admins:', error);
      } finally {
        setLoadingAdmins(false);
      }

      // Fetch teachers
      setLoadingTeachers(true);
      try {
        const [pendingResponse, allResponse] = await Promise.all([
          fetch(`${API_URL}/admin/teachers/pending`, {
            headers: { 'Authorization': `Bearer ${token}` },
          }),
          fetch(`${API_URL}/admin/teachers`, {
            headers: { 'Authorization': `Bearer ${token}` },
          }),
        ]);

        const allTeachers: Teacher[] = [];

        if (pendingResponse.ok) {
          const pending = await pendingResponse.json();
          const mapped = pending.map((t: any) => ({
            id: t.id,
            username: t.email.split('@')[0] || t.fullName.toLowerCase().replace(' ', '_'),
            name: t.fullName,
            email: t.email,
            avatar: t.avatar,
            submitDate: new Date(t.createdAt).toLocaleDateString(),
            reviewDate: '-',
            details: `${t.education || 'N/A'}, ${t.experience || 'N/A'}`,
            status: 'waiting' as const,
            education: t.education,
            experience: t.experience,
            subjects: t.subjects,
            cvUrl: t.cvUrl,
            website: t.website,
            linkedin: t.linkedin,
            bio: t.bio,
            location: t.location,
          }));
          allTeachers.push(...mapped);
        }

        if (allResponse.ok) {
          const all = await allResponse.json();
          const mapped = all.map((t: any) => ({
            id: t.id,
            username: t.email.split('@')[0] || t.fullName.toLowerCase().replace(' ', '_'),
            name: t.fullName,
            email: t.email,
            avatar: t.avatar,
            submitDate: new Date(t.createdAt).toLocaleDateString(),
            reviewDate: t.teacherProfile?.updatedAt ? new Date(t.teacherProfile.updatedAt).toLocaleDateString() : '-',
            details: `${t.teacherProfile?.education || 'N/A'}, ${t.teacherProfile?.experience || 'N/A'}`,
            status: (t.teacherProfile?.isApproved ? 'approved' : t.teacherProfile?.rejectedAt ? 'require-update' : 'waiting') as any,
            education: t.teacherProfile?.education,
            experience: t.teacherProfile?.experience,
            subjects: t.teacherProfile?.subjects,
            cvUrl: t.teacherProfile?.cvUrl,
            website: t.teacherProfile?.website,
            linkedin: t.teacherProfile?.linkedin,
            bio: t.bio,
            location: t.location,
          }));
          
          // Merge with pending, avoid duplicates
          const pendingIds = new Set(allTeachers.map(t => t.id));
          mapped.forEach((t: Teacher) => {
            if (!pendingIds.has(t.id)) {
              allTeachers.push(t);
            }
          });
        }

        setTeachers(allTeachers);
      } catch (error) {
        console.error('Error fetching teachers:', error);
      } finally {
        setLoadingTeachers(false);
      }
    };

    fetchData();
  }, []);

  // Filter and sort admins
  const filteredAdmins = admins.filter(admin => {
    const matchesSearch = admin.email.toLowerCase().includes(adminSearch.toLowerCase()) ||
                         admin.name.toLowerCase().includes(adminSearch.toLowerCase());
    const matchesStatus = adminStatusFilter === 'all' || admin.status === adminStatusFilter;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    if (adminSort === 'asc') {
      return a.email.localeCompare(b.email);
    } else {
      return b.email.localeCompare(a.email);
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
  const handleCreateAdmin = async (data: AdminFormData) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

      const response = await fetch(`${API_URL}/admin/admins`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          fullName: data.name,
        }),
      });

      if (response.ok) {
        const newAdmin = await response.json();
        const mappedAdmin: Admin = {
          id: newAdmin.id,
          name: newAdmin.fullName,
          email: newAdmin.email,
          status: "offline",
          avatar: newAdmin.avatar,
        };
        setAdmins((prev) => [...prev, mappedAdmin]);
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to create admin');
      }
    } catch (error) {
      console.error('Error creating admin:', error);
      alert('Failed to create admin');
    }
  };

  const handleUpdateAdmin = (data: AdminFormData) => {
    if (!selectedAdmin) return;
    setAdmins((prev) =>
      prev.map((a) => (a.id === selectedAdmin.id ? { ...a, ...data } : a))
    );
  };

  const handleDeleteAdmin = async (id: string) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

      const response = await fetch(`${API_URL}/admin/admins/${id}/delete`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setAdmins((prev) => prev.filter((a) => a.id !== id));
      } else {
        console.error('Failed to delete admin');
        alert('Failed to delete admin');
      }
    } catch (error) {
      console.error('Error deleting admin:', error);
      alert('Failed to delete admin');
    }
  };

  const handleApproveTeacher = async (id: string) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

      const response = await fetch(`${API_URL}/admin/teachers/${id}/approve`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setTeachers((prev) =>
          prev.map((t) => (t.id === id ? { ...t, status: "approved" } : t))
        );
      } else {
        console.error('Failed to approve teacher');
      }
    } catch (error) {
      console.error('Error approving teacher:', error);
    }
  };

  const handleRejectTeacher = async () => {
    if (!selectedTeacher || !rejectReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

      const response = await fetch(`${API_URL}/admin/teachers/${selectedTeacher.id}/reject`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: rejectReason }),
      });

      if (response.ok) {
        setTeachers((prev) =>
          prev.map((t) => (t.id === selectedTeacher.id ? { ...t, status: "require-update" } : t))
        );
        setIsRejectDialogOpen(false);
        setRejectReason('');
        setSelectedTeacher(null);
      } else {
        console.error('Failed to reject teacher');
        alert('Failed to reject teacher');
      }
    } catch (error) {
      console.error('Error rejecting teacher:', error);
      alert('Failed to reject teacher');
    }
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
            <thead className="text-left border-b border-gray-200">
              <tr>
                <th className="pb-3">Admin</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
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
                          <div className="font-medium">{a.name}</div>
                          <div className="text-sm text-gray-500">{a.email}</div>
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
            <thead className="text-left border-b border-gray-200">
              <tr>
                <th className="pb-3">Teacher</th>
                <th className="pb-3">Submit Date</th>
                <th className="pb-3">Review Date</th>
                <th className="pb-3">Details</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
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
                      <button 
                        onClick={() => {
                          setSelectedTeacher(t);
                          setIsTeacherDetailsOpen(true);
                        }}
                        className="text-blue-500 hover:text-blue-700 text-sm flex items-center gap-1"
                      >
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
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleApproveTeacher(t.id)}
                            className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-md text-sm"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setSelectedTeacher(t);
                              setIsRejectDialogOpen(true);
                            }}
                            className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm"
                          >
                            Reject
                          </button>
                        </div>
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

      {/* --- TEACHER DETAILS DIALOG --- */}
      <Dialog.Root open={isTeacherDetailsOpen} onOpenChange={setIsTeacherDetailsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 w-[90vw] max-w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-semibold text-[#161853]">
                Teacher Profile Details
              </Dialog.Title>
              <Dialog.Close className="rounded-full p-1.5 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>

            {selectedTeacher && (
              <div className="space-y-4">
                {/* Teacher Info */}
                <div className="flex items-center gap-4 pb-4 border-b">
                  <div className="w-16 h-16 bg-[#161853] rounded-full overflow-hidden flex items-center justify-center">
                    <Image
                      src={selectedTeacher.avatar || defaultLogoUrl}
                      alt={selectedTeacher.name}
                      width={64}
                      height={64}
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{selectedTeacher.name}</h3>
                    <p className="text-sm text-gray-500">{selectedTeacher.email}</p>
                    {selectedTeacher.location && (
                      <p className="text-sm text-gray-500">📍 {selectedTeacher.location}</p>
                    )}
                  </div>
                </div>

                {/* Bio */}
                {selectedTeacher.bio && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-1">Bio</h4>
                    <p className="text-sm text-gray-600">{selectedTeacher.bio}</p>
                  </div>
                )}

                {/* Education */}
                {selectedTeacher.education && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-1">Education</h4>
                    <p className="text-sm text-gray-600">{selectedTeacher.education}</p>
                  </div>
                )}

                {/* Experience */}
                {selectedTeacher.experience && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-1">Experience</h4>
                    <p className="text-sm text-gray-600">{selectedTeacher.experience} years</p>
                  </div>
                )}

                {/* Subjects */}
                {selectedTeacher.subjects && selectedTeacher.subjects.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">Subjects</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedTeacher.subjects.map((subject, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                        >
                          {subject}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* CV URL */}
                {selectedTeacher.cvUrl && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-1">CV / Resume</h4>
                    <a
                      href={selectedTeacher.cvUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-500 hover:text-blue-700 underline flex items-center gap-1"
                    >
                      View CV Document
                    </a>
                  </div>
                )}

                {/* Website */}
                {selectedTeacher.website && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-1">Website</h4>
                    <a
                      href={selectedTeacher.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-500 hover:text-blue-700 underline"
                    >
                      {selectedTeacher.website}
                    </a>
                  </div>
                )}

                {/* LinkedIn */}
                {selectedTeacher.linkedin && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-1">LinkedIn</h4>
                    <a
                      href={selectedTeacher.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-500 hover:text-blue-700 underline"
                    >
                      {selectedTeacher.linkedin}
                    </a>
                  </div>
                )}

                {/* Dates */}
                <div className="pt-4 border-t">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <h4 className="font-medium text-gray-700 mb-1">Submit Date</h4>
                      <p className="text-gray-600">{selectedTeacher.submitDate}</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-700 mb-1">Review Date</h4>
                      <p className="text-gray-600">{selectedTeacher.reviewDate}</p>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-1">Status</h4>
                  <span
                    className={clsx(
                      "px-3 py-1 rounded-full text-sm capitalize inline-block",
                      selectedTeacher.status === "waiting"
                        ? "bg-yellow-100 text-yellow-700"
                        : selectedTeacher.status === "require-update"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-green-100 text-green-700"
                    )}
                  >
                    {selectedTeacher.status.replace("-", " ")}
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-end mt-6 pt-4 border-t">
              <Dialog.Close className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-800 border rounded-md hover:bg-gray-50">
                Close
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* --- REJECT TEACHER DIALOG --- */}
      <Dialog.Root open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 w-[90vw] max-w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-semibold text-[#161853]">
                Reject Teacher Application
              </Dialog.Title>
              <Dialog.Close className="rounded-full p-1.5 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for rejecting{" "}
              <span className="font-medium">{selectedTeacher?.name}</span>'s application.
              This will help them understand what needs to be improved.
            </p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason (required)..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-h-[120px] resize-none"
            />

            <div className="flex justify-end space-x-2 mt-6">
              <Dialog.Close className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-800 border rounded-md hover:bg-gray-50">
                Cancel
              </Dialog.Close>
              <button
                onClick={handleRejectTeacher}
                disabled={!rejectReason.trim()}
                className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Reject Application
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

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
    password: "",
    confirmPassword: "",
    email: "",
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
        password: "",
        confirmPassword: "",
        email: defaultData.email,
      });
    } else {
      setFormData({
        name: "",
        password: "",
        confirmPassword: "",
        email: "",
      });
    }
  }, [mode, defaultData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const errors: Partial<Record<keyof AdminFormData, string>> = {};

    if (!formData.name?.trim()) errors.name = "Name is required";
    if (!formData.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      errors.email = "Valid email is required";

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
              ["email", "Email"],
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
