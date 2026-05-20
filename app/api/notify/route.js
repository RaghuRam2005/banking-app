/**
 * /api/notify — Nova Bank notification dispatcher
 *
 * Supported notification types:
 *   account_approved  — user's account request was approved
 *   account_rejected  — user's account request was denied
 *   kyc_approved      — KYC application approved
 *   kyc_rejected      — KYC application rejected
 *   loan_approved     — loan application approved
 *   loan_rejected     — loan application rejected
 *
 * Uses nodemailer if SMTP env vars are configured; otherwise logs to console.
 */
import { NextResponse } from 'next/server'

// ── Build the email content for each notification type ───────
function buildEmail(type, to, data) {
  const bankName = 'Nova Bank'

  const templates = {
    account_approved: {
      subject: `[${bankName}] Your ${data.type} account has been approved`,
      text: `Dear Customer,\n\nGreat news! Your ${data.type} account (${data.accountNumber}) with ${bankName} has been approved and is now active.\n\nYou can log in to your dashboard to start using your account.\n\nThank you for banking with us.\n\n${bankName} Team`,
    },
    account_rejected: {
      subject: `[${bankName}] Account request update`,
      text: `Dear Customer,\n\nWe regret to inform you that your ${data.type} account request (${data.accountNumber}) could not be approved.\n\nReason: ${data.reason}\n\nIf you believe this is an error, please contact our support team.\n\n${bankName} Team`,
    },
    kyc_approved: {
      subject: `[${bankName}] KYC Verification Approved`,
      text: `Dear ${data.name},\n\nYour KYC verification has been approved. You now have full access to all ${bankName} services.\n\n${bankName} Team`,
    },
    kyc_rejected: {
      subject: `[${bankName}] KYC Verification Update`,
      text: `Dear ${data.name},\n\nYour KYC verification could not be approved.\n\nReason: ${data.reason}\n\nPlease resubmit with correct documents.\n\n${bankName} Team`,
    },
    loan_approved: {
      subject: `[${bankName}] Loan Application Approved`,
      text: `Dear ${data.name},\n\nYour loan of ₹${data.amount?.toLocaleString('en-IN')} has been approved!\n\nYour EMI will be ₹${data.emi?.toLocaleString('en-IN')}/month. The amount has been disbursed to your account.\n\n${bankName} Team`,
    },
    loan_rejected: {
      subject: `[${bankName}] Loan Application Update`,
      text: `Dear ${data.name},\n\nWe were unable to approve your loan application.\n\nReason: ${data.reason}\n\nFor assistance, please contact our support team.\n\n${bankName} Team`,
    },
  }

  return templates[type] ?? null
}

// ── Main handler ─────────────────────────────────────────────
export async function POST(req) {
  try {
    const { type, to, data } = await req.json()

    if (!type || !to) {
      return NextResponse.json({ error: 'Missing type or to' }, { status: 400 })
    }

    const email = buildEmail(type, to, data ?? {})
    if (!email) {
      return NextResponse.json({ error: `Unknown notification type: ${type}` }, { status: 400 })
    }

    // ── Try to send via nodemailer if SMTP is configured ──
    const smtpHost = process.env.SMTP_HOST
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS
    const smtpFrom = process.env.SMTP_FROM ?? 'noreply@novabank.local'

    if (smtpHost && smtpUser && smtpPass) {
      const nodemailer = await import('nodemailer')
      const transporter = nodemailer.default.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: false,
        auth: { user: smtpUser, pass: smtpPass },
      })
      await transporter.sendMail({
        from: `"Nova Bank" <${smtpFrom}>`,
        to,
        subject: email.subject,
        text:    email.text,
      })
      console.log(`[NOTIFY] Email sent → ${to} (${type})`)
    } else {
      // Log to console when SMTP is not configured (dev / test)
      console.log(`[NOTIFY] (no SMTP configured — logging only)`)
      console.log(`  TO:      ${to}`)
      console.log(`  SUBJECT: ${email.subject}`)
      console.log(`  BODY:\n${email.text}`)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[NOTIFY] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
