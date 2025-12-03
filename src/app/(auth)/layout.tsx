export const dynamic = 'force-dynamic';

import { LOGO_URL, APP_NAME } from '@/lib/constants';
import Image from 'next/image';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30">
      <div className="mb-8 flex flex-col items-center">
        <Image
          src={LOGO_URL}
          alt={APP_NAME}
          width={200}
          height={60}
          className="mb-4"
          priority
        />
        <h1 className="text-2xl font-semibold text-foreground">
          Project Dashboard
        </h1>
      </div>
      {children}
    </div>
  );
}
