import { redirect } from 'next/navigation';

type Props = { params: Promise<{ id: string }> };

export default async function ListingDecisionRedirect({ params }: Props) {
  const { id } = await params;
  redirect(`/decision?id=${encodeURIComponent(id)}`);
}
