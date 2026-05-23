type SendOpts = {
  to: string;
  subject: string;
  html: string;
  from?: string;
  attempt?: number;
};

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'no-reply@example.com';

if (!RESEND_API_KEY) {
  throw new Error('Missing RESEND_API_KEY env var');
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendInviteEmail(opts: SendOpts) {
  const maxAttempts = 3;
  const attempt = opts.attempt ?? 1;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: opts.from ?? RESEND_FROM,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html
    })
  });

  if (response.ok) {
    return response.json();
  }

  const payload = await response.text();
  const error = new Error(`Resend API error ${response.status}: ${payload}`);
  if (attempt < maxAttempts && (response.status >= 500 || response.status === 429)) {
    await sleep(200 * Math.pow(2, attempt - 1));
    return sendInviteEmail({ ...opts, attempt: attempt + 1 });
  }

  throw error;
}
