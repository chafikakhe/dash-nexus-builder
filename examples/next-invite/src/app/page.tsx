import InviteModal from '@/components/InviteModal';

export default function HomePage() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Dash Nexus Invite Example</h1>
      <p>This example shows how to send and accept invitations via Supabase.</p>
      <InviteModal orgId="00000000-0000-0000-0000-000000000000" onClose={() => undefined} />
      <p>
        Replace the example `orgId` with a real org ID from your Supabase project.
      </p>
    </main>
  );
}
