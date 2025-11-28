import { redirect, useParams } from 'next/navigation';

export default function StudentRoot() {
  const { id } = useParams();
  redirect(`/student/${id}/dashboard`);
}
