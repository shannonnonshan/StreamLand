import { redirect } from 'next/navigation';

export default function StudentRoot() {
  // This will automatically redirect from /student to /student/dashboard
  redirect('/student/dashboard');
}
