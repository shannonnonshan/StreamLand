'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import CompleteOAuthModal from '@/component/(modal)/completeOAuth';
import { useAuth } from '@/hooks/useAuth';

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
    // Teacher fields
    teacherCV?: File;
    teacherCertificates?: File[];
    teacherSubjects?: string;
    teacherExperience?: string;
    teacherSpecialty?: string;
    teacherIntroduction?: string;
    // Student fields
    studentID?: string;
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
      // Teacher fields
      teacherCV: data.teacherCV,
      teacherCertificates: data.teacherCertificates,
      teacherSubjects: data.teacherSubjects,
      teacherExperience: data.teacherExperience,
      teacherSpecialty: data.teacherSpecialty,
      teacherIntroduction: data.teacherIntroduction,
      // Student fields
      studentID: data.studentID,
      studentSchool: data.studentSchool,
      studentClass: data.studentClass,
    });

    if (result.success && result.user) {
      // Redirect based on role
      if (result.user.role === 'TEACHER') {
        router.push(`/teacher/${result.user.id}`);
      } else {
        router.push('/student/dashboard');
      }
    } else {
      throw new Error(result.error || 'Đăng ký thất bại');
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
