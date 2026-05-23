'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function RejectInvitePage() {
  const params = useSearchParams();
  const token = params?.get('token') ?? '';
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [message, setMessage] = useState('Processing rejection...');

  useEffect(() => {
    if (!token) {
      setMessage('Missing token.');
      return;
    }

    async function rejectInvite() {
      const session = await supabase.auth.getSession();
      if (!session?.data?.session) {
        setMessage('Please sign in to reject the invitation.');
        return;
      }

      const { error } = await supabase.rpc('reject_invitation', { p_token: token });
      if (error) {
        setMessage(error.message || 'Unable to reject invitation.');
        return;
      }

      setMessage('Invitation rejected. Redirecting...');
      setTimeout(() => router.push('/'), 1400);
    }

    rejectInvite();
  }, [token, router, supabase]);

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Reject Invitation</h1>
      <p>{message}</p>
    </main>
  );
}
