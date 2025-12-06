import { getDashboardData } from '@/app/actions/dashboard';
import { DashboardContent } from '@/components/dashboard/dashboard-content';

// Dashboard fetches data server-side and passes to client component
export default async function DashboardPage() {
  const data = await getDashboardData();

  return <DashboardContent initialData={data} />;
}
