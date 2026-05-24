/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X, Info, Eye, EyeOff, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, Filter } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { raleway } from "@/utils/front";

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
  submitDateRaw: string;
  reviewDate: string;
  reviewDateRaw: string;
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

type AdminFormDialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "create" | "update";
  defaultData?: Admin | null;
  onSubmit: (data: AdminFormData) => void;
};

function AdminFormDialog(props: AdminFormDialogProps) {
  return <AdminFormDialogImpl {...props} />;
}

type AdminSortKey = "name" | "status";
type TeacherSortKey = "username" | "submitDateRaw" | "reviewDateRaw" | "status";

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
  const [isCVPreviewOpen, setIsCVPreviewOpen] = useState(false);
  const [cvPreviewUrl, setCVPreviewUrl] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"admin" | "teacher">("admin");

  const [adminPage, setAdminPage] = useState(1);
  const [teacherPage, setTeacherPage] = useState(1);
  const [adminSort, setAdminSort] = useState<'asc' | 'desc'>('asc');
  const [adminSortKey, setAdminSortKey] = useState<AdminSortKey>('name');
  const [teacherSort, setTeacherSort] = useState<'asc' | 'desc'>('asc');
  const [teacherSortKey, setTeacherSortKey] = useState<TeacherSortKey>('username');
  const [adminSearch, setAdminSearch] = useState('');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [adminStatusFilter, setAdminStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [teacherStatusFilter, setTeacherStatusFilter] = useState<'all' | 'waiting' | 'require-update' | 'approved'>('all');
  const [adminPageSize, setAdminPageSize] = useState(5);
  const [teacherPageSize, setTeacherPageSize] = useState(5);

  const filteredAdmins = useMemo(() => {
    return admins.filter((admin) => {
      const matchesSearch = admin.email.toLowerCase().includes(adminSearch.toLowerCase()) ||
        admin.name.toLowerCase().includes(adminSearch.toLowerCase());
      const matchesStatus = adminStatusFilter === 'all' || admin.status === adminStatusFilter;
      return matchesSearch && matchesStatus;
    }).sort((a, b) => {
      const direction = adminSort === 'asc' ? 1 : -1;
      const leftValue = a[adminSortKey].toString().toLowerCase();
      const rightValue = b[adminSortKey].toString().toLowerCase();

      return leftValue.localeCompare(rightValue) * direction;
    });
  }, [admins, adminSearch, adminStatusFilter, adminSort, adminSortKey]);

  const filteredTeachers = useMemo(() => {
    return teachers.filter((teacher) => {
      const matchesSearch = teacher.username.toLowerCase().includes(teacherSearch.toLowerCase()) ||
        teacher.name.toLowerCase().includes(teacherSearch.toLowerCase()) ||
        teacher.email.toLowerCase().includes(teacherSearch.toLowerCase());
      const matchesStatus = teacherStatusFilter === 'all' || teacher.status === teacherStatusFilter;
      return matchesSearch && matchesStatus;
    }).sort((a, b) => {
      const direction = teacherSort === 'asc' ? 1 : -1;

      if (teacherSortKey === 'submitDateRaw' || teacherSortKey === 'reviewDateRaw') {
        const leftTime = a[teacherSortKey] ? new Date(a[teacherSortKey]).getTime() : 0;
        const rightTime = b[teacherSortKey] ? new Date(b[teacherSortKey]).getTime() : 0;
        return (leftTime - rightTime) * direction;
      }

      const leftValue = a[teacherSortKey].toString().toLowerCase();
      const rightValue = b[teacherSortKey].toString().toLowerCase();
      return leftValue.localeCompare(rightValue) * direction;
    });
  }, [teachers, teacherSearch, teacherStatusFilter, teacherSort, teacherSortKey]);

  const totalAdminPages = Math.max(1, Math.ceil(filteredAdmins.length / adminPageSize));
  const totalTeacherPages = Math.max(1, Math.ceil(filteredTeachers.length / teacherPageSize));

  const safeAdminPage = Math.min(adminPage, totalAdminPages);
  const safeTeacherPage = Math.min(teacherPage, totalTeacherPages);

  const paginatedAdmins = useMemo(() => {
    return filteredAdmins.slice((safeAdminPage - 1) * adminPageSize, safeAdminPage * adminPageSize);
  }, [filteredAdmins, safeAdminPage, adminPageSize]);

  const paginatedTeachers = useMemo(() => {
    return filteredTeachers.slice((safeTeacherPage - 1) * teacherPageSize, safeTeacherPage * teacherPageSize);
  }, [filteredTeachers, safeTeacherPage, teacherPageSize]);

  const adminFirstItem = filteredAdmins.length === 0 ? 0 : (safeAdminPage - 1) * adminPageSize + 1;
  const adminLastItem = Math.min(safeAdminPage * adminPageSize, filteredAdmins.length);
  const teacherFirstItem = filteredTeachers.length === 0 ? 0 : (safeTeacherPage - 1) * teacherPageSize + 1;
  const teacherLastItem = Math.min(safeTeacherPage * teacherPageSize, filteredTeachers.length);

  const resetAdminFilters = () => {
    setAdminSearch('');
    setAdminStatusFilter('all');
    setAdminPage(1);
  };

  const resetTeacherFilters = () => {
    setTeacherSearch('');
    setTeacherStatusFilter('all');
    setTeacherPage(1);
  };

  const getAdminStatusClasses = (status: Admin['status']) => {
    return status === 'online'
      ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
      : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
  };

  const getTeacherStatusClasses = (status: Teacher['status']) => {
    if (status === 'waiting') return 'bg-amber-100 text-amber-700 ring-1 ring-amber-200';
    if (status === 'require-update') return 'bg-sky-100 text-sky-700 ring-1 ring-sky-200';
    return 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200';
  };

  useEffect(() => {
    setAdminPage((current) => Math.min(current, totalAdminPages));
  }, [totalAdminPages]);

  useEffect(() => {
    setTeacherPage((current) => Math.min(current, totalTeacherPages));
  }, [totalTeacherPages]);


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
            submitDateRaw: t.createdAt,
            reviewDate: '-',
            reviewDateRaw: '',
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
            submitDateRaw: t.createdAt,
            reviewDate: t.teacherProfile?.updatedAt ? new Date(t.teacherProfile.updatedAt).toLocaleDateString() : '-',
            reviewDateRaw: t.teacherProfile?.updatedAt ?? '',
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

  const adminToolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search name or email..."
          value={adminSearch}
          onChange={(e) => setAdminSearch(e.target.value)}
          className="w-40 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 sm:w-56"
        />
      </div>
      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
        <Filter className="h-4 w-4 text-slate-400" />
        <select
          value={adminStatusFilter}
          onChange={(e) => setAdminStatusFilter(e.target.value as 'all' | 'online' | 'offline')}
          className="bg-transparent text-sm font-medium text-slate-700 outline-none"
        >
          <option value="all">All status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </select>
      </div>
      <button
        onClick={resetAdminFilters}
        className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
      >
        Clear
      </button>
    </div>
  );

  const teacherToolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search name, username or email..."
          value={teacherSearch}
          onChange={(e) => setTeacherSearch(e.target.value)}
          className="w-40 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 sm:w-56"
        />
      </div>
      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
        <Filter className="h-4 w-4 text-slate-400" />
        <select
          value={teacherStatusFilter}
          onChange={(e) => setTeacherStatusFilter(e.target.value as 'all' | 'waiting' | 'require-update' | 'approved')}
          className="bg-transparent text-sm font-medium text-slate-700 outline-none"
        >
          <option value="all">All status</option>
          <option value="waiting">Waiting</option>
          <option value="require-update">Require update</option>
          <option value="approved">Approved</option>
        </select>
      </div>
      <button
        onClick={resetTeacherFilters}
        className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
      >
        Clear
      </button>
    </div>
  );

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-700">
                  Account management
                </div>
                <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-[2.15rem]">
                  Manage account
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Review administrators and teachers from a compact two-tab dashboard.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Admins</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">{admins.length}</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Teachers</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">{teachers.length}</p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Pending</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">
                    {teachers.filter((teacher) => teacher.status === 'waiting').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTab('admin')}
                className={clsx(
                  'rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition',
                  activeTab === 'admin'
                    ? 'bg-slate-950 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                )}
              >
                Administrators
              </button>
              <button
                onClick={() => setActiveTab('teacher')}
                className={clsx(
                  'rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition',
                  activeTab === 'teacher'
                    ? 'bg-slate-950 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                )}
              >
                Teachers
              </button>
            </div>
          </div>
        </section>

        {activeTab === 'admin' ? (
          <div className="rounded-[26px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Administrators</p>
                  <p className="mt-1 text-sm text-slate-600">{filteredAdmins.length} item{filteredAdmins.length === 1 ? '' : 's'}</p>
                </div>
                {adminToolbar}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-3 pt-3">
                <button
                  onClick={() => {
                    setDialogMode('create');
                    setSelectedAdmin(null);
                    setIsFormOpen(true);
                  }}
                  className="rounded-full bg-linear-to-r from-cyan-500 to-blue-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:from-cyan-600 hover:to-blue-600"
                >
                  Add admin
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 shadow-sm">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Per page</span>
                    <select value={adminPageSize} onChange={(e) => setAdminPageSize(Number(e.target.value))} className="bg-transparent text-sm font-medium text-slate-700 outline-none">
                      {[5, 10, 20].map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </div>
                  <button onClick={() => setAdminPage(1)} disabled={safeAdminPage === 1} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40" aria-label="First page" title="First page">
                    <ChevronsLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => setAdminPage((page) => Math.max(1, page - 1))} disabled={safeAdminPage === 1} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Previous page" title="Previous page">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="rounded-full bg-slate-950 px-3 py-1.5 text-sm font-semibold text-white">{safeAdminPage} / {totalAdminPages}</div>
                  <button onClick={() => setAdminPage((page) => Math.min(totalAdminPages, page + 1))} disabled={safeAdminPage === totalAdminPages} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Next page" title="Next page">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button onClick={() => setAdminPage(totalAdminPages)} disabled={safeAdminPage === totalAdminPages} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Last page" title="Last page">
                    <ChevronsRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-180">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">
                      <button
                        type="button"
                        onClick={() => {
                          setAdminSortKey('name');
                          setAdminSort((current) => current === 'asc' && adminSortKey === 'name' ? 'desc' : 'asc');
                        }}
                        className="inline-flex items-center gap-1 text-left transition hover:text-slate-900"
                        title="Sort by admin name"
                      >
                        <span>Admin</span>
                        <span className="text-[10px]">{adminSortKey === 'name' ? (adminSort === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </button>
                    </th>
                    <th className="px-5 py-3 font-semibold">
                      <button
                        type="button"
                        onClick={() => {
                          setAdminSortKey('status');
                          setAdminSort((current) => current === 'asc' && adminSortKey === 'status' ? 'desc' : 'asc');
                        }}
                        className="inline-flex items-center gap-1 text-left transition hover:text-slate-900"
                        title="Sort by status"
                      >
                        <span>Status</span>
                        <span className="text-[10px]">{adminSortKey === 'status' ? (adminSort === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </button>
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingAdmins ? (
                    <tr>
                      <td colSpan={3} className="py-10 text-center text-slate-500"><Loader2 className="mr-2 inline-block h-5 w-5 animate-spin" />Loading administrators...</td>
                    </tr>
                  ) : paginatedAdmins.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-10 text-center text-slate-500">No administrators found</td>
                    </tr>
                  ) : paginatedAdmins.map((admin) => (
                    <tr key={admin.id} className="align-top transition hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-950">
                            <Image src={admin.avatar || defaultLogoUrl} alt={admin.name} width={40} height={40} className="object-cover" />
                          </div>
                          <div>
                            <div className="font-medium text-slate-950">{admin.name}</div>
                            <div className="text-sm text-slate-500">{admin.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={clsx('inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]', getAdminStatusClasses(admin.status))}>{admin.status}</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => { setDialogMode('update'); setSelectedAdmin(admin); setIsFormOpen(true); }} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">Update</button>
                          <button onClick={() => { setSelectedAdmin(admin); setIsDeleteOpen(true); }} className="rounded-full border border-rose-200 px-3 py-1.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 pb-4 pt-3 sm:px-5">
              <div className="flex items-center justify-between rounded-2xl border border-slate-100 px-3 py-2.5">
                <div className="text-xs text-slate-500">Showing {adminFirstItem} to {adminLastItem} of {filteredAdmins.length} administrators</div>
                <div className="text-xs text-slate-500">Administrators</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-[26px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Teachers</p>
                  <p className="mt-1 text-sm text-slate-600">{filteredTeachers.length} item{filteredTeachers.length === 1 ? '' : 's'}</p>
                </div>
                {teacherToolbar}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-3 pt-3">
                <div className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 shadow-sm">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Per page</span>
                  <select value={teacherPageSize} onChange={(e) => setTeacherPageSize(Number(e.target.value))} className="bg-transparent text-sm font-medium text-slate-700 outline-none">
                    {[5, 10, 20].map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </div>
                <button onClick={() => setTeacherPage(1)} disabled={safeTeacherPage === 1} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40" aria-label="First page" title="First page">
                  <ChevronsLeft className="h-4 w-4" />
                </button>
                <button onClick={() => setTeacherPage((page) => Math.max(1, page - 1))} disabled={safeTeacherPage === 1} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Previous page" title="Previous page">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="rounded-full bg-slate-950 px-3 py-1.5 text-sm font-semibold text-white">{safeTeacherPage} / {totalTeacherPages}</div>
                <button onClick={() => setTeacherPage((page) => Math.min(totalTeacherPages, page + 1))} disabled={safeTeacherPage === totalTeacherPages} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Next page" title="Next page">
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button onClick={() => setTeacherPage(totalTeacherPages)} disabled={safeTeacherPage === totalTeacherPages} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Last page" title="Last page">
                  <ChevronsRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-245">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">
                      <button
                        type="button"
                        onClick={() => {
                          setTeacherSortKey('username');
                          setTeacherSort((current) => current === 'asc' && teacherSortKey === 'username' ? 'desc' : 'asc');
                        }}
                        className="inline-flex items-center gap-1 text-left transition hover:text-slate-900"
                        title="Sort by teacher name"
                      >
                        <span>Teacher</span>
                        <span className="text-[10px]">{teacherSortKey === 'username' ? (teacherSort === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </button>
                    </th>
                    <th className="px-5 py-3 font-semibold">
                      <button
                        type="button"
                        onClick={() => {
                          setTeacherSortKey('submitDateRaw');
                          setTeacherSort((current) => current === 'asc' && teacherSortKey === 'submitDateRaw' ? 'desc' : 'asc');
                        }}
                        className="inline-flex items-center gap-1 text-left transition hover:text-slate-900"
                        title="Sort by submit date"
                      >
                        <span>Submit Date</span>
                        <span className="text-[10px]">{teacherSortKey === 'submitDateRaw' ? (teacherSort === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </button>
                    </th>
                    <th className="px-5 py-3 font-semibold">
                      <button
                        type="button"
                        onClick={() => {
                          setTeacherSortKey('reviewDateRaw');
                          setTeacherSort((current) => current === 'asc' && teacherSortKey === 'reviewDateRaw' ? 'desc' : 'asc');
                        }}
                        className="inline-flex items-center gap-1 text-left transition hover:text-slate-900"
                        title="Sort by review date"
                      >
                        <span>Review Date</span>
                        <span className="text-[10px]">{teacherSortKey === 'reviewDateRaw' ? (teacherSort === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </button>
                    </th>
                    <th className="px-5 py-3 font-semibold">
                      <button
                        type="button"
                        onClick={() => {
                          setTeacherSortKey('status');
                          setTeacherSort((current) => current === 'asc' && teacherSortKey === 'status' ? 'desc' : 'asc');
                        }}
                        className="inline-flex items-center gap-1 text-left transition hover:text-slate-900"
                        title="Sort by status"
                      >
                        <span>Status</span>
                        <span className="text-[10px]">{teacherSortKey === 'status' ? (teacherSort === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </button>
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingTeachers ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-500"><Loader2 className="mr-2 inline-block h-5 w-5 animate-spin" />Loading teachers...</td>
                    </tr>
                  ) : paginatedTeachers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-500">No teachers found</td>
                    </tr>
                  ) : paginatedTeachers.map((teacher) => (
                    <tr key={teacher.id} className="align-top transition hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-950">
                            <Image src={teacher.avatar || defaultLogoUrl} alt={teacher.name} width={40} height={40} className="object-cover" />
                          </div>
                          <div>
                            <div className="font-medium text-slate-950">{teacher.username}</div>
                            <div className="text-sm text-slate-500">{teacher.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-700">{teacher.submitDate}</td>
                      <td className="px-5 py-4 text-sm text-slate-700">{teacher.reviewDate}</td>
                      <td className="px-5 py-4">
                        <span className={clsx('inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]', getTeacherStatusClasses(teacher.status))}>
                          {teacher.status.replace('-', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedTeacher(teacher);
                              setIsTeacherDetailsOpen(true);
                            }}
                            className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                          >
                            Review
                          </button>
                          {teacher.status === 'waiting' && (
                            <>
                              <button onClick={() => handleApproveTeacher(teacher.id)} className="rounded-full bg-linear-to-r from-emerald-500 to-teal-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:from-emerald-600 hover:to-teal-600">
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedTeacher(teacher);
                                  setIsRejectDialogOpen(true);
                                }}
                                className="rounded-full bg-linear-to-r from-rose-500 to-red-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:from-rose-600 hover:to-red-600"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 pb-4 pt-3 sm:px-5">
              <div className="flex items-center justify-between rounded-2xl border border-slate-100 px-3 py-2.5">
                <div className="text-xs text-slate-500">Showing {teacherFirstItem} to {teacherLastItem} of {filteredTeachers.length} teachers</div>
                <div className="text-xs text-slate-500">Teachers</div>
              </div>
            </div>
          </div>
        )}

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
          <Dialog.Content className={`fixed left-1/2 top-1/2 max-h-[90vh] w-[90vw] max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[28px] border border-white/10 bg-white p-0 shadow-[0_30px_120px_rgba(15,23,42,0.35)] ${raleway.className}`}>
            <div className="flex shrink-0 items-start justify-between gap-4 bg-[#292C6D] px-6 py-5 text-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/60">Teacher Review</p>
                <Dialog.Title className="mt-1 text-2xl font-bold">
                  Teacher Profile Details
                </Dialog.Title>
                <p className="mt-1 text-sm text-white/75">Review profile information, CV, and moderation outcome</p>
              </div>
              <Dialog.Close className="rounded-full border border-white/10 bg-white/10 p-2 text-white transition hover:bg-white/20">
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>

            <div className="max-h-[90vh] overflow-y-auto bg-slate-50 px-6 py-6">

            {selectedTeacher && (
              (() => {
                const isApprovedTeacher = selectedTeacher.status === "approved";

                return (
              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="grid gap-4">
                  <section className="rounded-3xl border border-[#292C6D]/10 bg-white p-4 shadow-sm">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#292C6D]/50">Teacher Details</p>
                        <h3 className="mt-1 text-base font-bold text-slate-900">Profile</h3>
                      </div>
                      <span className={clsx(
                        "rounded-full px-3 py-1 text-xs font-semibold",
                        selectedTeacher.status === "waiting"
                          ? "bg-amber-100 text-amber-700"
                          : selectedTeacher.status === "require-update"
                          ? "bg-sky-100 text-sky-700"
                          : "bg-emerald-100 text-emerald-700"
                      )}>
                        {selectedTeacher.status.replace("-", " ")}
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-slate-950">
                        <Image
                          src={selectedTeacher.avatar || defaultLogoUrl}
                          alt={selectedTeacher.name}
                          width={64}
                          height={64}
                          className="object-cover"
                        />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-950">{selectedTeacher.name}</h4>
                        <p className="text-xs text-slate-500">{selectedTeacher.email}</p>
                        {selectedTeacher.location && (
                          <p className="text-xs text-slate-500">📍 {selectedTeacher.location}</p>
                        )}
                      </div>
                    </div>
                  </section>

                  <section className="rounded-3xl border border-[#292C6D]/10 bg-white p-4 shadow-sm">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-3 sm:col-span-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Bio</p>
                        <p className="mt-1 text-xs leading-5 text-slate-700">{selectedTeacher.bio || "N/A"}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Education</p>
                        <p className="mt-1 text-xs leading-5 text-slate-700">{selectedTeacher.education || "N/A"}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Experience</p>
                        <p className="mt-1 text-xs leading-5 text-slate-700">{selectedTeacher.experience ? `${selectedTeacher.experience} years` : "N/A"}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Subjects</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {selectedTeacher.subjects && selectedTeacher.subjects.length > 0 ? (
                            selectedTeacher.subjects.map((subject, idx) => (
                              <span
                                key={idx}
                                className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700"
                              >
                                {subject}
                              </span>
                            ))
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">N/A</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-3xl border border-[#292C6D]/10 bg-white p-4 shadow-sm">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Submit Date</p>
                        <p className="mt-1 text-xs leading-5 text-slate-700">{selectedTeacher.submitDate}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Website</p>
                        <p className="mt-1 text-xs leading-5 text-slate-700 break-all">{selectedTeacher.website || "N/A"}</p>
                      </div>
                    </div>

                    {selectedTeacher.linkedin && (
                      <div className="mt-3 rounded-2xl bg-slate-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">LinkedIn</p>
                        <a
                          href={selectedTeacher.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 block break-all text-xs font-medium text-[#292C6D] underline decoration-[#EC255A]/40 underline-offset-4"
                        >
                          {selectedTeacher.linkedin}
                        </a>
                      </div>
                    )}
                  </section>

                </div>

                <div className="space-y-4">
                  {isApprovedTeacher ? (
                    <>
                      <section className="rounded-3xl border border-[#292C6D]/10 bg-white p-4 shadow-sm">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl bg-slate-50 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Review Date</p>
                            <p className="mt-1 text-xs leading-5 text-slate-700">{selectedTeacher.reviewDate}</p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Moderation</p>
                            <p className="mt-1 text-xs font-semibold text-emerald-700">Approved</p>
                          </div>
                        </div>
                      </section>

                      <section className="rounded-3xl border border-[#292C6D]/10 bg-white p-4 shadow-sm">
                        <p className="text-sm font-semibold text-slate-900">This teacher is already approved.</p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">No moderation actions are available.</p>
                      </section>

                      {selectedTeacher.cvUrl && (
                        <section className="rounded-3xl border border-[#292C6D]/10 bg-white p-4 shadow-sm">
                          <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">CV / Resume</p>
                              <p className="mt-1 text-xs text-slate-700">Available for preview and download</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setCVPreviewUrl(selectedTeacher.cvUrl || null);
                                  setIsCVPreviewOpen(true);
                                }}
                                className="inline-flex items-center gap-2 rounded-full bg-[#292C6D] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#1f2350]"
                              >
                                <Eye className="w-4 h-4" /> Preview
                              </button>
                              <a
                                href={selectedTeacher.cvUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                              >
                                Download
                              </a>
                            </div>
                          </div>
                        </section>
                      )}
                    </>
                  ) : (
                    <>
                      <section className="rounded-3xl border border-[#292C6D]/10 bg-white p-4 shadow-sm">
                        <label className="mb-2 block text-sm font-semibold text-slate-900">Rejection Reason</label>
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder={selectedTeacher.status === 'require-update' ? 'Edit the existing rejection reason here' : 'Enter reason for rejection (saved to teacher profile)'}
                          className="min-h-20 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
                        />
                      </section>

                      <section className="rounded-3xl border border-[#292C6D]/10 bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap justify-end gap-3">
                          <button
                            onClick={() => selectedTeacher && handleApproveTeacher(selectedTeacher.id)}
                            className="inline-flex items-center rounded-full bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectTeacher()}
                            disabled={!rejectReason.trim()}
                            className={`inline-flex items-center rounded-full px-3.5 py-2 text-sm font-semibold transition focus:ring-2 focus:ring-red-500 focus:ring-offset-2
                              ${rejectReason.trim() ? 'bg-[#EC255A] text-white hover:bg-[#d31f4c]' : 'cursor-not-allowed bg-slate-100 text-slate-400'}`}
                          >
                            Reject
                          </button>
                        </div>
                      </section>

                      {selectedTeacher.cvUrl && (
                        <section className="rounded-3xl border border-[#292C6D]/10 bg-white p-4 shadow-sm">
                          <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">CV / Resume</p>
                              <p className="mt-1 text-xs text-slate-700">Available for preview and download</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setCVPreviewUrl(selectedTeacher.cvUrl || null);
                                  setIsCVPreviewOpen(true);
                                }}
                                className="inline-flex items-center gap-2 rounded-full bg-[#292C6D] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#1f2350]"
                              >
                                <Eye className="w-4 h-4" /> Preview
                              </button>
                              <a
                                href={selectedTeacher.cvUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                              >
                                Download
                              </a>
                            </div>
                          </div>
                        </section>
                      )}
                    </>
                  )}
                </div>
              </div>
                );
              })()
            )}

              <div className="flex justify-end mt-6 pt-4 border-t">
                <Dialog.Close className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  Close
                </Dialog.Close>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* --- REJECT TEACHER DIALOG --- */}
      <Dialog.Root open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className={`fixed top-1/2 left-1/2 w-[90vw] max-w-125 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg ${raleway.className}`}>
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
              <span className="font-medium">{selectedTeacher?.name}</span>&apos;s application.
              This will help them understand what needs to be improved.
            </p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason (required)..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-h-30 resize-none"
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
          <Dialog.Content className="fixed top-1/2 left-1/2 w-[90vw] max-w-100 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg">
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

      {/* --- CV PREVIEW PANEL --- */}
      {isCVPreviewOpen && (
        <div className={`fixed inset-0 z-50 ${raleway.className}`}>
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsCVPreviewOpen(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-3xl bg-white shadow-lg flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b p-4">
              <h3 className="text-lg font-semibold text-[#161853]">CV Preview</h3>
              <button
                onClick={() => setIsCVPreviewOpen(false)}
                className="rounded-full p-1.5 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-auto">
              {cvPreviewUrl && (
                <div className="w-full h-full flex items-center justify-center bg-gray-50">
                  {/* Check if it's a PDF */}
                  {cvPreviewUrl.toLowerCase().endsWith('.pdf') ? (
                    <iframe
                      src={cvPreviewUrl}
                      className="w-full h-full"
                      title="CV Preview"
                    />
                  ) : (
                    /* For images and other formats */
                    <div className="p-4 w-full h-full flex flex-col items-center justify-center overflow-auto">
                      {cvPreviewUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <img
                          src={cvPreviewUrl}
                          alt="CV Preview"
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <div className="text-center text-gray-500">
                          <p className="mb-4">Preview not available for this file type</p>
                          <a
                            href={cvPreviewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                          >
                            Open in New Tab
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
  );
}

/* ------------------- REUSABLE DIALOG FORM ------------------- */
function AdminFormDialogImpl({
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
          className="fixed top-1/2 left-1/2 w-[90vw] max-w-112.5
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
