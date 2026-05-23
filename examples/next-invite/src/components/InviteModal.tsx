'use client';

import React, { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function InviteModal({ orgId, onClose }: { orgId: string; onClose?: () => void }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const session = await supabase.auth.getSession();
    if (!session?.data?.session?.access_token) {
      setMessage('Please sign in to send invites.');
      setLoading(false);
      return;
    }

    const response = await fetch('/api/invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.data.session.access_token}`
      },
      body: JSON.stringify({ email, org_id: orgId, role: 'member' })
    });

    const body = await response.json();
    if (!response.ok) {
      setMessage(body.error || 'Failed to send invite');
    } else {
      setMessage('Invite sent successfully');
      setEmail('');
    }

    setLoading(false);
  }

  return (
    <section style={{ marginTop: '1.5rem', maxWidth: 560 }}>
      <form onSubmit={submit} style={{ display: 'grid', gap: '1rem' }}>
        <div>
          <label htmlFor="invite-email" style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
            Invite email
          </label>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="invitee@example.com"
            required
            style={{ width: '100%' }}
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Sending…' : 'Send invite'}
        </button>
        {message && <p>{message}</p>}
        {onClose && (
          <button type="button" onClick={onClose} style={{ background: '#6b7280' }}>
            Close
          </button>
        )}
      </form>
    </section>
  );
}
