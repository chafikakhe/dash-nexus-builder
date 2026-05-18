import emailjs from "@emailjs/browser";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
  console.warn(
    "EmailJS is not fully configured. Set VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, and VITE_EMAILJS_PUBLIC_KEY in your environment.",
  );
}
// Initialize EmailJS once if we have the public key
if (PUBLIC_KEY) {
  try {
    // init is idempotent
    emailjs.init(PUBLIC_KEY);
  } catch (err) {
    console.warn("EmailJS init failed:", err);
  }
}

function isValidEmail(e: string) {
  return typeof e === "string" && /.+@.+\..+/.test(e);
}

export async function sendInviteEmail(email: string, workspaceName: string, inviteLink: string) {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    throw new Error("EmailJS environment variables are missing.");
  }

  if (!isValidEmail(email)) {
    throw new Error("Invalid recipient email provided to sendInviteEmail");
  }

  const templateParams = {
    // common field names used in EmailJS templates; keep extras to increase compatibility
    to_email: email,
    user_email: email,
    recipient_email: email,
    workspace_name: workspaceName,
    invite_link: inviteLink,
  };

  try {
    // prefer the init'd path (no public key passed), but support passing key too
    const result = await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams);
    return result;
  } catch (err) {
    console.error("EmailJS sendInviteEmail failed", { err, templateParams });
    // rethrow so caller can show UI error and we keep stack trace
    throw err;
  }
}
