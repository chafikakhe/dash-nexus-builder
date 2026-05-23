import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dash Nexus Invite Example',
  description: 'Example invite flow using Supabase and Resend'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
