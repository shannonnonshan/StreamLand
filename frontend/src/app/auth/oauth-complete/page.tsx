'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import CompleteOAuthModal from '@/component/(modal)/completeOAuth';
import { useAuth } from '@/hooks/useAuth';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function OAuthCompletePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { completeOAuthRegistration } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [provider, setProvider] = useState<'google' | 'github'>('google');
  const [profile, setProfile] = useState<{
    socialId: string;
    email: string;
    fullName: string;
    avatar?: string;
  } | null>(null);

  useEffect(() => {
    const providerParam = searchParams.get('provider') as 'google' | 'github';
    const profileParam = searchParams.get('profile');

    console.log('OAuth Complete Page - URL Params:', {
      provider: providerParam,
      profile: profileParam,
      fullURL: window.location.href,
    });

    if (providerParam && profileParam) {
      try {
        const profileData = JSON.parse(decodeURIComponent(profileParam));
        
        console.log('Parsed profile data:', profileData);
        
        // Map backend field names to frontend
        const mappedProfile = {
          socialId: profileData.googleId || profileData.githubId,
          email: profileData.email,
          fullName: profileData.fullName,
          avatar: profileData.avatar,
        };

        console.log('Mapped profile:', mappedProfile);

        setProvider(providerParam);
        setProfile(mappedProfile);
        setIsModalOpen(true);
      } catch (error) {
        console.error('Error parsing profile data:', error);
        router.push('/');
      }
    } else {
      console.error('Missing provider or profile params - redirecting to home');
      router.push('/');
    }
  }, [searchParams, router]);

  const handleComplete = async (data: {
    role: 'STUDENT' | 'TEACHER';
    teacherCV?: File;
    teacherIntroduction?: string;
    subjects?: string[];
    experience?: number;
    education?: string;
    website?: string;
    linkedin?: string;
    studentSchool?: string;
    studentClass?: string;
  }) => {
    if (!profile) return;

    const result = await completeOAuthRegistration({
      provider,
      socialId: profile.socialId,
      email: profile.email,
      fullName: profile.fullName,
      avatar: profile.avatar,
      role: data.role,
      teacherIntroduction: data.teacherIntroduction,
      subjects: data.subjects,
      experience: data.experience,
      education: data.education,
      website: data.website,
      linkedin: data.linkedin,
      studentSchool: data.studentSchool,
      studentClass: data.studentClass,
    });

    if (!result.success) {
      throw new Error(result.error || 'Registration failed. Please try again.');
    }

    if (data.role === 'TEACHER') {
      sessionStorage.setItem(
        `pending-teacher-profile:${profile.email.toLowerCase()}`,
        JSON.stringify({
          subjects: data.subjects,
          experience: data.experience,
          education: data.education,
          bio: data.teacherIntroduction,
        }),
      );

      if (data.teacherCV) {
        const cvFile = data.teacherCV;
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          sessionStorage.setItem(
            `pending-teacher-cv:${profile.email.toLowerCase()}`,
            JSON.stringify({ name: cvFile.name, type: cvFile.type, data: base64 }),
          );
        };
        reader.readAsDataURL(cvFile);
      }
    }

    // ✅ Redirect
    if (result.user?.role === 'TEACHER') {
      router.push(`/teacher/${result.user.id}`);
    } else {
      router.push('/student/dashboard');
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Processing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CompleteOAuthModal
        isOpen={isModalOpen}
        closeModal={() => router.push('/')}
        provider={provider}
        profile={profile}
        onComplete={handleComplete}
      />
    </div>
  );
}
