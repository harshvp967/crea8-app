import { ReactNode } from 'react';

export default async function IntegrationLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="bg-newBgColor text-textColor flex flex-1 min-h-screen w-screen">
      {children}
    </div>
  );
}
