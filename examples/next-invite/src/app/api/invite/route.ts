import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';
import { sendInviteEmail } from '@/lib/email/resend';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const bearerToken = authHeader.replace('Bearer ', '').trim();
    const userResponse = await supabaseAdmin.auth.getUser(bearerToken);
    if (userResponse.error || !userResponse.data?.user) {
      return NextResponse.json({ error: 'Invalid user token' }, { status: 401 });
    }

    const body = await req.json();
    const { email, org_id, role = 'member', dashboard_ids = [] } = body;
    if (!email || !org_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const inviteInsert = {
      email,
      org_id,
      role,
      invited_by: userResponse.data.user.id,
      dashboard_ids
    };

    const { data: invite, error: insertError } = await supabaseAdmin
      .from('invitations')
      .insert(inviteInsert)
      .select('*')
      .single();

    if (insertError) {
      console.error('Invitation insert failed', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/accept?token=${invite.token}`;
    const html = `
      <p>You were invited to join an organization.</p>
      <p><a href="${acceptUrl}">Accept invitation</a></p>
      <p>If you do not want to join, ignore this email.</p>
    `;

    try {
      await sendInviteEmail({
        to: email,
        subject: 'You were invited to join',
        html
      });
    } catch (emailError) {
      console.error('Resend email failed', emailError);
    }

    return NextResponse.json({ success: true, invite });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message ?? 'Internal server error' }, { status: 500 });
  }
}
