export const dynamic = 'force-dynamic';

import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Toaster } from '@/components/ui/sonner';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="md:ml-64">
        <Header />
        <main className="p-4 md:p-6">{children}</main>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}
