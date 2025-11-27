/**
 * Track watch activity for livestreams and videos
 * This will update the student's streak when they view content on a new day
 */
export async function trackWatchActivity(
  contentType: 'livestream' | 'video',
  contentId: string
): Promise<{ streak: number; updated: boolean } | null> {
  try {
    const token = localStorage.getItem('accessToken');
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    if (!token) {
      console.warn('No auth token found, skipping activity tracking');
      return null;
    }

    const response = await fetch(`${API_URL}/student/track-activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        contentType,
        contentId,
      }),
    });

    if (!response.ok) {
      console.error('Failed to track activity:', response.status);
      return null;
    }

    const data = await response.json();
    
    // If streak was updated, show a notification or toast
    if (data.updated) {
      console.log(`🔥 Streak updated: ${data.streak} days!`);
    }

    return data;
  } catch (error) {
    console.error('Error tracking watch activity:', error);
    return null;
  }
}
