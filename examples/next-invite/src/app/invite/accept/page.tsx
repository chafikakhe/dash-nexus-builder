'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function AcceptInvitePage() {
  const params = useSearchParams();
  const token = params?.get('token') ?? '';
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [message, setMessage] = useState('Processing invitation...');

  useEffect(() => {
    if (!token) {
      setMessage('Missing token.');
      return;
    }

    async function acceptInvite() {
      const session = await supabase.auth.getSession();
      if (!session?.data?.session) {
        setMessage('Please sign in to accept the invitation.');
        return;
      }

      const { error } = await supabase.rpc('accept_invitation', { p_token: token });
      if (error) {
        setMessage(error.message || 'Unable to accept invitation.');
        return;
      }

      setMessage('Invitation accepted. Redirecting...');
      setTimeout(() => router.push('/'), 1400);
    }

    acceptInvite();
  }, [token, router, supabase]);

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Accept Invitation</h1>
      <p>{message}</p>
    </main>
  );
}
