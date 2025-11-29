import { redirect } from 'next/navigation';

interface StudentRootProps {
  params: { id: string };
}

export default function StudentRoot({ params }: StudentRootProps) {
  redirect(`/student/${params.id}/dashboard`);
}
