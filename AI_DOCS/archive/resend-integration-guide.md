# Resend Integration Plan for inDeal (Fit to Current Codebase)

Testing backend base URL: https://api-test.indealeg.com

This plan updates the existing Nodemailer-based flow to [Resend](https://resend.com), using the current Node.js/Express structure and configs in `src/config/env.js` and `src/config/mailer.js`. The goal is a drop-in replacement for the existing `sendMail()` calls in services like `src/services/auth.service.js`.

---

## 1. Why Resend Over Nodemailer?

| Aspect         | Nodemailer               | Resend                     |
| -------------- | ------------------------ | -------------------------- |
| Setup          | Requires SMTP config     | API key only               |
| Deliverability | Depends on SMTP provider | Built-in (high reputation) |
| Templates      | Manual HTML              | React Email support        |
| Analytics      | None                     | Opens, clicks, bounces     |
| Pricing        | Free (SMTP costs vary)   | 3,000 emails/month free    |

For a B2B platform like inDeal, Resend's deliverability and analytics are valuable for transactional emails (deal notifications, verification, etc.).

---

## 2. Initial Setup (Matches Current Env Loader)

### 2.1 Create Resend Account

1. Sign up at [resend.com](https://resend.com)
2. Verify your domain (e.g., `indeal.com`) in the Resend dashboard
3. Generate an API key from **Settings → API Keys**

### 2.2 Install the SDK

```bash
npm install resend
```

### 2.3 Environment Variables

Add to your `.env` file:

```env
# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@indeal.com
RESEND_FROM_NAME=inDeal
```

Update your env loader to include these (current file: `src/config/env.js`):

```typescript
// src/config/env.js
RESEND_API_KEY: z.string().optional(),
RESEND_FROM_EMAIL: z.string().default('no-reply@indeal.local'),
RESEND_FROM_NAME: z.string().default('inDeal Support'),
```

---

## 3. Replace `src/config/mailer.js` with Resend

Replace the current Nodemailer transport with a Resend client while keeping the same `sendMail()` interface so existing services (e.g. `src/services/auth.service.js`) continue to work.

```javascript
// src/config/mailer.js
const { Resend } = require('resend');
const config = require('./env');
const logger = require('../utils/logger');

let resend = null;

if (config.resend.apiKey) {
  resend = new Resend(config.resend.apiKey);
  logger.info('Resend client configured');
} else {
  logger.warn('RESEND_API_KEY is missing. Emails will not be sent until configured.');
}

const sendMail = async (options) => {
  if (!resend) {
    const error = new Error('Resend client is not configured');
    error.code = 'MAILER_NOT_CONFIGURED';
    throw error;
  }

  const from = options.from || `${config.resend.fromName} <${config.resend.fromEmail}>`;
  const { data, error } = await resend.emails.send({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    replyTo: options.replyTo,
  });

  if (error) {
    logger.error('Resend send failed', { error, to: options.to });
    const err = new Error('Email delivery failed');
    err.code = 'RESEND_SEND_FAILED';
    throw err;
  }

  logger.info('Email sent successfully', { id: data?.id, to: options.to });
  return { id: data?.id };
};

module.exports = {
  sendMail,
};
```

---

## 4. Keep Existing Templates (Already in `auth.service.js`)

Email HTML/text is already created inline in `src/services/auth.service.js` for:

- Password reset OTP
- Email verification

Optional: move these into a dedicated template module later. For now, keep as-is so the Resend swap is minimal.

```typescript
// src/services/email.templates.ts

interface TemplateData {
  [key: string]: string | number | undefined;
}

// Base wrapper for consistent branding
function wrapTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>inDeal</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} inDeal. All rights reserved.</p>
      <p>This is a transactional email from your B2B marketplace account.</p>
    </div>
  </div>
</body>
</html>`;
}

export const emailTemplates = {
  // User verification after registration
  verification(data: { firstName: string; verificationUrl: string }): string {
    return wrapTemplate(`
      <h2>Welcome to inDeal, ${data.firstName}!</h2>
      <p>Thank you for registering. Please verify your email address to activate your account.</p>
      <a href="${data.verificationUrl}" class="button">Verify Email</a>
      <p>If the button doesn't work, copy this link:<br>
      <small>${data.verificationUrl}</small></p>
      <p>This link expires in 24 hours.</p>
    `);
  },

  // Password reset request
  passwordReset(data: { firstName: string; resetUrl: string }): string {
    return wrapTemplate(`
      <h2>Password Reset Request</h2>
      <p>Hi ${data.firstName},</p>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>
      <a href="${data.resetUrl}" class="button">Reset Password</a>
      <p>If you didn't request this, you can safely ignore this email.</p>
      <p>This link expires in 1 hour.</p>
    `);
  },

  // Company approval notification
  companyApproved(data: { companyName: string; agentName: string }): string {
    return wrapTemplate(`
      <h2>Your Company Has Been Approved! 🎉</h2>
      <p>Hi ${data.agentName},</p>
      <p>Great news! <strong>${data.companyName}</strong> has been verified and is now active on inDeal.</p>
      <p>You can now:</p>
      <ul>
        <li>Create and publish deals (Auctions & RFQs)</li>
        <li>Browse and apply to other companies' deals</li>
        <li>Message other verified companies</li>
      </ul>
      <a href="https://indeal.com/dashboard" class="button">Go to Dashboard</a>
    `);
  },

  // Company rejected notification
  companyRejected(data: { companyName: string; agentName: string; reason: string }): string {
    return wrapTemplate(`
      <h2>Company Registration Update</h2>
      <p>Hi ${data.agentName},</p>
      <p>Unfortunately, <strong>${data.companyName}</strong> could not be approved at this time.</p>
      <p><strong>Reason:</strong> ${data.reason}</p>
      <p>You can update your company profile and documents, then resubmit for review.</p>
      <a href="https://indeal.com/company/edit" class="button">Update Profile</a>
    `);
  },

  // New deal request received (for deal publisher)
  newDealRequest(data: {
    dealName: string;
    applicantCompany: string;
    offerAmount?: number;
    dealUrl: string;
  }): string {
    const offerLine = data.offerAmount
      ? `<p><strong>Offer Amount:</strong> $${data.offerAmount.toLocaleString()}</p>`
      : '';

    return wrapTemplate(`
      <h2>New Request on Your Deal</h2>
      <p>You have a new request on <strong>${data.dealName}</strong>.</p>
      <p><strong>From:</strong> ${data.applicantCompany}</p>
      ${offerLine}
      <a href="${data.dealUrl}" class="button">View Request</a>
    `);
  },

  // Deal request status update (for applicant)
  dealRequestUpdate(data: {
    dealName: string;
    status: 'accepted' | 'rejected';
    publisherCompany: string;
  }): string {
    const statusText =
      data.status === 'accepted'
        ? '✅ Your request has been <strong>accepted</strong>!'
        : '❌ Your request has been <strong>declined</strong>.';

    return wrapTemplate(`
      <h2>Deal Request Update</h2>
      <p>Your request for <strong>${data.dealName}</strong> has been reviewed by ${data.publisherCompany}.</p>
      <p>${statusText}</p>
      ${
        data.status === 'accepted'
          ? '<p>You can now message them directly to discuss next steps.</p>'
          : "<p>Don't worry — there are many other opportunities on inDeal!</p>"
      }
      <a href="https://indeal.com/deals" class="button">Browse Deals</a>
    `);
  },

  // New chat message notification
  newMessage(data: { senderCompany: string; preview: string; chatUrl: string }): string {
    return wrapTemplate(`
      <h2>New Message</h2>
      <p><strong>${data.senderCompany}</strong> sent you a message:</p>
      <blockquote style="border-left: 3px solid #2563eb; padding-left: 15px; color: #555;">
        "${data.preview.substring(0, 150)}${data.preview.length > 150 ? '...' : ''}"
      </blockquote>
      <a href="${data.chatUrl}" class="button">Reply Now</a>
    `);
  },
};
```

---

## 5. Optional: Queue Emails with BullMQ (Fits `src/config/queue.js`)

If you want non-blocking delivery (see `AI_DOCS/email_verification_performance.md`), add a queue + worker. You already have helpers in `src/config/queue.js`.

```javascript
// src/queues/email.queue.js
const { createQueue, createWorker } = require('../config/queue');
const { sendMail } = require('../config/mailer');
const logger = require('../utils/logger');

const emailQueue = createQueue('email', {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

createWorker(
  'email',
  async (job) => {
    const { to, subject, html, text, replyTo } = job.data;
    logger.info('Processing email job', { jobId: job.id, to, subject });
    await sendMail({ to, subject, html, text, replyTo });
  },
  { concurrency: 5 }
);

module.exports = { emailQueue };
```

---

## 6. Usage Examples (Current Services)

### In Controllers

```typescript
`src/services/auth.service.js` already calls `sendMail()` for OTP and verification. After swapping `src/config/mailer.js`, no other code changes are required for basic delivery.

If you add the queue, update the calls in `sendOtpEmail`/`sendVerificationEmail` to enqueue instead of awaiting `sendMail()`:
```

```javascript
// inside src/services/auth.service.js
const { emailQueue } = require('../queues/email.queue');

await emailQueue.add('send-email', { to, subject, text, html });
```

### In Deal Request Handler

```typescript
// src/controllers/deal-requests.controller.ts
import { emailService } from '../services/email.service';
import { emailTemplates } from '../services/email.templates';

export const createDealRequest = async (req: Request, res: Response) => {
  // ... create deal request logic

  // Notify the deal publisher
  await emailService.sendAsync({
    to: dealPublisher.email,
    subject: `New request on ${deal.deal_name}`,
    html: emailTemplates.newDealRequest({
      dealName: deal.deal_name,
      applicantCompany: applicantCompany.name,
      offerAmount: requestOffer,
      dealUrl: `https://indeal.com/deals/${deal.id}`,
    }),
  });

  res.status(201).json({ message: 'Request submitted' });
};
```

---

## 7. Testing Emails

### Development Mode

Resend provides a test email address that doesn't actually send:

```javascript
// In development, use Resend's test address
const testRecipient = 'delivered@resend.dev';
```

### API Endpoint for Testing

```javascript
// src/routes/v1/system.routes.js (add to your existing system routes)
router.post('/test-email', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }

  await sendMail({
    to: 'delivered@resend.dev',
    subject: 'inDeal Test Email',
    html: '<strong>inDeal test</strong>',
  });

  res.json({ ok: true });
});
```

---

## 8. Replace SMTP Env Usage

Once Resend is working, remove or ignore the SMTP variables in `.env` and `src/config/env.js`:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_SECURE`
- `SUPPORT_EMAIL_FROM`
- `SUPPORT_EMAIL_NAME`

You can keep them temporarily for backward compatibility, but the end goal is to delete them and use `RESEND_*` only.
Status: removed from `.env` and `.env.example` in this repo; `src/config/env.js` now uses `RESEND_*`.

---

## 9. Monitoring & Webhooks (Optional)

Resend can send webhooks for email events. Set up in dashboard and handle:

```javascript
// src/routes/v1/webhooks.routes.js
router.post('/resend', express.raw({ type: 'application/json' }), (req, res) => {
  const event = JSON.parse(req.body);

  switch (event.type) {
    case 'email.delivered':
      logger.info('Email delivered', { emailId: event.data.email_id });
      break;
    case 'email.bounced':
      logger.warn('Email bounced', { email: event.data.to });
      break;
    case 'email.complained':
      logger.warn('Spam complaint', { email: event.data.to });
      break;
    default:
      logger.info('Resend webhook received', { type: event.type });
  }

  res.sendStatus(200);
});
```

---

## Quick Reference (Current Files)

| Task             | Code                                                              |
| ---------------- | ----------------------------------------------------------------- |
| Send immediately | `sendMail({ to, subject, html, text })` in `src/config/mailer.js` |
| Send via queue   | `emailQueue.add('send-email', { to, subject, html, text })`       |
| Verification     | `sendVerificationEmail()` in `src/services/auth.service.js`       |
| OTP              | `sendOtpEmail()` in `src/services/auth.service.js`                |
| Test email       | Send to `delivered@resend.dev`                                    |

---

## Pricing Note

Resend's free tier includes 3,000 emails/month with the `onboarding.resend.dev` domain. For production with your own domain (`@indeal.com`), you'll need a paid plan starting at $20/month for 50,000 emails.
// add to module exports
resend: {
apiKey: env.RESEND_API_KEY,
fromEmail: env.RESEND_FROM_EMAIL,
fromName: env.RESEND_FROM_NAME,
},
