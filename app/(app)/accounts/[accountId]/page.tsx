import AccountsScreen from '@/components/screens/AccountsScreen';

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  return <AccountsScreen initialAccountId={accountId} />;
}
