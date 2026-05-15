import CategoryDetailScreen from '@/components/screens/CategoryDetailScreen';

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;
  return <CategoryDetailScreen categoryId={categoryId} />;
}
