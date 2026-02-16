import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload: Record<string, unknown> | null = null;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const record = (payload?.record ?? payload?.new ?? payload) as Record<string, unknown> | null;
  if (!record) {
    return new Response("Missing record", { status: 400 });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const notifyEmail = Deno.env.get("NOTIFY_EMAIL") ?? "";
  const fromEmail = Deno.env.get("FROM_EMAIL") ?? "noreply@resend.dev";
  const replyToEmail = Deno.env.get("REPLY_TO_EMAIL") ?? "";

  if (!resendApiKey || !notifyEmail) {
    return new Response("Missing RESEND_API_KEY or NOTIFY_EMAIL", { status: 500 });
  }

  const fullname = String(record.fullname ?? "").trim();
  const email = String(record.email ?? "").trim();
  const mobile = String(record.mobile ?? "").trim();
  const age = String(record.age ?? "").trim();
  const coachingPreference = String(record.coaching_preference ?? "").trim();
  const ptGender = String(record.pt_gender ?? "").trim();
  const goal = String(record.goal ?? "").trim();
  const createdAt = String(record.created_at ?? "").trim();

  const subject = `New training enquiry${fullname ? `: ${fullname}` : ""}`;
  const textLines = [
    `Name: ${fullname || "-"}`,
    `Email: ${email || "-"}`,
    `Mobile: ${mobile || "-"}`,
    `Age: ${age || "-"}`,
    `Coaching preference: ${coachingPreference || "-"}`,
    `PT gender: ${ptGender || "-"}`,
    `Goal: ${goal || "-"}`,
    `Submitted: ${createdAt || "-"}`,
  ];

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; color: #111; line-height: 1.5;">
      <h2 style="margin: 0 0 12px;">New training enquiry</h2>
      <p><strong>Name:</strong> ${fullname || "-"}</p>
      <p><strong>Email:</strong> ${email || "-"}</p>
      <p><strong>Mobile:</strong> ${mobile || "-"}</p>
      <p><strong>Age:</strong> ${age || "-"}</p>
      <p><strong>Coaching preference:</strong> ${coachingPreference || "-"}</p>
      <p><strong>PT gender:</strong> ${ptGender || "-"}</p>
      <p><strong>Goal:</strong><br/>${goal || "-"}</p>
      <p><strong>Submitted:</strong> ${createdAt || "-"}</p>
    </div>
  `;

  const emailPayload: Record<string, unknown> = {
    from: fromEmail,
    to: notifyEmail,
    subject,
    text: textLines.join("\n"),
    html,
  };

  if (replyToEmail) {
    emailPayload.reply_to = replyToEmail;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(emailPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Resend error:", errorText);
    const body = errorText ? `Resend error: ${errorText}` : "Resend error";
    return new Response(body, {
      status: 502,
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
