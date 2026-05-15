import InvestmentsScreen from '@/components/screens/InvestmentsScreen';

export default async function InvestmentDetailPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  return <InvestmentsScreen initialAccountId={accountId} />;
}
