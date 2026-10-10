'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { Landmark } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('access_token');

    const timeout = setTimeout(() => {
      if (token) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [router]);

  return (
    <main className="page-loader">
      <div className="page-loader-content">
        <div className="page-loader-logo">
          <Landmark size={28} />
        </div>

        <h1>Zarova</h1>

        <p>Preparing your financial workspace...</p>

        <div className="page-loader-spinner" />
      </div>
    </main>
  );
}
