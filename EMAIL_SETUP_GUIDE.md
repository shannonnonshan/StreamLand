# Email Setup Guide - Fix OTP Not Received in Production

## Problem
OTP emails are not being received by users in production because the email service is blocked or not properly configured.

## Solution Implemented

✅ **Improved Mail Service** with:
- Configuration validation
- Better error handling
- Development mode logging (shows OTP in console)
- Production-ready error messages

## Steps to Fix in Production

### Option 1: Verify Your Resend Domain (Recommended)

1. **Login to Resend Dashboard**: https://resend.com/login

2. **Add and Verify Your Domain**:
   - Go to **Domains** section
   - Click **Add Domain**
   - Enter your domain: `streamlandforstudyute.com`
   - Add the DNS records they provide to your domain's DNS settings:
     ```
     TXT record: _resend (for verification)
     MX record: (for receiving emails)
     ```

3. **Wait for Verification** (usually 5-30 minutes)

4. **Update FROM Email** in `.env`:
   ```env
   RESEND_FROM_EMAIL=noreply@streamlandforstudyute.com
   ```

### Option 2: Use Resend's Default Domain (Quick Fix)

If you don't have a custom domain verified yet, use Resend's default:

```env
RESEND_FROM_EMAIL=onboarding@resend.dev
```

**Note**: This works immediately but may have lower deliverability.

### Option 3: Check Your API Key

1. **Verify API Key is Production Key**:
   - Go to Resend Dashboard → API Keys
   - Make sure you're using a production key, not a test key
   - Production keys start with `re_`

2. **Current Key** in `.env`:
   ```env
   RESEND_API_KEY=re_QTaiYDpr_B72uh4BxvA7gtzLmtLCi4tbd
   ```

3. **Test the API Key**:
   ```bash
   curl -X POST 'https://api.resend.com/emails' \
     -H 'Authorization: Bearer re_QTaiYDpr_B72uh4BxvA7gtzLmtLCi4tbd' \
     -H 'Content-Type: application/json' \
     -d '{
       "from": "onboarding@resend.dev",
       "to": "your-email@example.com",
       "subject": "Test Email",
       "html": "<p>Testing email delivery</p>"
     }'
   ```

### Option 4: Check Resend Dashboard for Errors

1. Go to **Logs** in Resend Dashboard
2. Check recent email send attempts
3. Look for error messages like:
   - "Domain not verified"
   - "API key invalid"
   - "Rate limit exceeded"

### Option 5: Alternative Email Services (If Resend Doesn't Work)

If Resend continues to have issues, you can switch to alternatives:

#### A. SendGrid (Free tier: 100 emails/day)
```bash
npm install @sendgrid/mail
```

```typescript
// In mail.service.ts
import * as sgMail from '@sendgrid/mail';

constructor() {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}
```

#### B. Mailgun (Free tier: 5,000 emails/month)
```bash
npm install mailgun.js
```

#### C. AWS SES (Very cheap, high deliverability)
```bash
npm install @aws-sdk/client-ses
```

## Environment Variables Reference

Make sure these are set in production:

```env
# Email Service (Resend)
RESEND_API_KEY=re_QTaiYDpr_B72uh4BxvA7gtzLmtLCi4tbd
RESEND_FROM_EMAIL=noreply@streamlandforstudyute.com

# Node Environment
NODE_ENV=production
```

## Testing in Development

When `NODE_ENV=development`, the OTP will be logged to console:
```
🔑 OTP for user@example.com: 123456
```

This allows testing without needing email configured.

## Troubleshooting Checklist

- [ ] RESEND_API_KEY is set correctly
- [ ] RESEND_FROM_EMAIL uses a verified domain
- [ ] Domain DNS records are configured
- [ ] API key is a production key (not test)
- [ ] Check Resend dashboard logs for errors
- [ ] Recipient email is not in spam folder
- [ ] Firewall/hosting doesn't block outbound HTTPS (port 443)

## Production Deployment

After fixing email, redeploy your application:

```bash
# Build backend
cd backend
npm run build

# Restart the service
pm2 restart all
# or
docker-compose restart backend
```

## Monitor Email Delivery

Check backend logs for email status:
```bash
# If using PM2
pm2 logs backend

# If using Docker
docker logs streamland-backend
```

Look for:
- ✅ Success: `✅ OTP email sent to user@example.com`
- ❌ Failure: `❌ Resend API error: [error message]`

## Support

If issues persist:
1. Check Resend status: https://resend.com/status
2. Contact Resend support: https://resend.com/support
3. Review Resend docs: https://resend.com/docs
