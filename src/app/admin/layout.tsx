import DealAlerts from '@/components/DealAlerts';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <DealAlerts />
    </>
  );
}
