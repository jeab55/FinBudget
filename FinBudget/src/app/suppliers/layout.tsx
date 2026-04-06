import AppLayout from '@/components/AppLayout';

export default function SuppliersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
