import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private resend?: Resend;
  private smtpTransporter?: Transporter;
  private fromEmail: string = '';
  private isConfigured: boolean = false;
  private emailProvider: 'smtp' | 'resend' | 'none' = 'none';

  constructor(private configService: ConfigService) {
    // Try to initialize SMTP first
    const smtpHost = this.configService.get('SMTP_HOST');
    const smtpRejectUnauthorizedRaw = this.configService.get('SMTP_TLS_REJECT_UNAUTHORIZED');
    const smtpRejectUnauthorized = !smtpRejectUnauthorizedRaw
      ? true
      : !['0', 'false', 'no'].includes(String(smtpRejectUnauthorizedRaw).toLowerCase());
    if (!smtpRejectUnauthorized) {
      // Local testing only: transporter tls.rejectUnauthorized will be disabled.
      // Avoid changing global TLS behavior; log a warning instead.
      this.logger.warn('⚠️ SMTP TLS certificate verification is disabled for local testing (rejectUnauthorized=false). Do not use in production.');
    }
    if (smtpHost) {
      try {
        this.smtpTransporter = nodemailer.createTransport({
          host: smtpHost,
          port: this.configService.get('SMTP_PORT') || 587,
          secure: this.configService.get('SMTP_PORT') === 465,
          tls: {
            // Allow disabling cert verification for local testing only
            rejectUnauthorized: smtpRejectUnauthorized,
          },
          auth: {
            user: this.configService.get('SMTP_USER'),
            pass: this.configService.get('SMTP_PASSWORD'),
          },
        });

        this.fromEmail = this.configService.get('SMTP_FROM') || 'noreply@streamland.com';
        this.emailProvider = 'smtp';
        this.isConfigured = true;

        this.logger.log('✅ SMTP email service initialized');
        this.logger.log(`📧 Using SMTP: ${smtpHost}:${this.configService.get('SMTP_PORT') || 587}`);
        this.logger.log(`📤 Sending emails from: ${this.fromEmail}`);
        return;
      } catch (error) {
        this.logger.error('❌ Failed to initialize SMTP:', error);
      }
    }

    // Fallback to Resend
    const resendApiKey = this.configService.get('RESEND_API_KEY');
    const resendFromEmail = this.configService.get('RESEND_FROM_EMAIL');

    if (!resendApiKey || !resendFromEmail) {
      this.logger.warn('⚠️  Neither SMTP nor Resend configured. Email sending will be disabled.');
      this.logger.warn('Configure either SMTP_* or RESEND_* environment variables');
      this.isConfigured = false;
      return;
    }

    try {
      this.resend = new Resend(resendApiKey);
      this.fromEmail = resendFromEmail;
      this.emailProvider = 'resend';
      this.isConfigured = true;

      this.logger.log('Resend email service initialized');
      this.logger.log(`Sending emails from: ${this.fromEmail}`);
    } catch (error) {
      this.logger.error('Failed to initialize Resend:', error);
      this.isConfigured = false;
    }
  }

  async sendOTP(email: string, otp: string, fullName?: string) {
    // Check if email service is configured
    if (!this.isConfigured) {
      this.logger.warn(`Email service not configured. OTP: ${otp} for ${email}`);
      if (process.env.NODE_ENV === 'development') {
        this.logger.log(`[DEV MODE] OTP for ${email}: ${otp}`);
        return { success: true, devMode: true };
      }
      return { 
        success: false, 
        error: 'Email service not configured. Please contact support.' 
      };
    }

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .otp-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
            .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>StreamLand</h1>
              <p>Leading Online Learning Platform</p>
            </div>
            <div class="content">
              <h2>Hello ${fullName || 'there'}!</h2>
              <p>Thank you for registering an account at <strong>StreamLand</strong>.</p>
              <p>To complete your registration, please use the OTP code below:</p>
              
              <div class="otp-box">
                <p style="margin: 0; color: #666;">Your OTP code is:</p>
                <div class="otp-code">${otp}</div>
                <p style="margin: 10px 0 0 0; color: #999; font-size: 14px;">Valid for 5 minutes</p>
              </div>

              <div class="warning">
                <strong>Important:</strong>
                <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                  <li>Do not share this OTP with anyone</li>
                  <li>StreamLand will never ask for your OTP via phone</li>
                  <li>If you didn't request this, please ignore this email</li>
                </ul>
              </div>

              <p>If you have any questions, please contact us at: <a href="mailto:support@streamland.com">support@streamland.com</a></p>
              
              <p style="margin-top: 30px;">Best regards,<br><strong>The StreamLand Team</strong></p>
            </div>
            <div class="footer">
              <p>&copy; 2025 StreamLand. All rights reserved.</p>
              <p>This is an automated email, please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `;

    try {
      if (this.emailProvider === 'smtp') {
        const info = await this.smtpTransporter!.sendMail({
          from: this.fromEmail,
          to: email,
          subject: 'Account Verification OTP - StreamLand',
          html: htmlContent,
        });

        this.logger.log(`OTP email sent to ${email} via SMTP (ID: ${info.messageId})`);
        return { success: true, messageId: info.messageId };
      } else if (this.emailProvider === 'resend') {
        const { data, error } = await this.resend!.emails.send({
          from: `StreamLand <${this.fromEmail}>`,
          to: [email],
          subject: 'Account Verification OTP - StreamLand',
          html: htmlContent,
        });

        if (error) {
          throw new Error(error.message);
        }

        this.logger.log(`✅ OTP email sent to ${email} via Resend (ID: ${data.id})`);
        return { success: true, emailId: data.id };
      }
      
      // This shouldn't happen, but return error for safety
      return {
        success: false,
        error: 'No email provider configured',
      };
    } catch (error) {
      this.logger.error('❌ Failed to send OTP email:');
      this.logger.error(error);
      if (process.env.NODE_ENV === 'development') {
        this.logger.warn(`[DEV MODE] Email exception. OTP for ${email}: ${otp}`);
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendTeacherApprovalEmail(email: string, fullName: string) {
    if (!this.isConfigured) {
      this.logger.warn(`Email not configured. Skipping teacher approval email for ${email}`);
      return { success: false, error: 'Email service not configured' };
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #161853 0%, #292C6D 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .badge { display: inline-block; background: #22c55e; color: white; padding: 8px 20px; border-radius: 20px; font-weight: bold; font-size: 16px; margin: 16px 0; }
          .cta { display: inline-block; background: linear-gradient(135deg, #161853 0%, #292C6D 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; margin: 20px 0; }
          .highlight { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0 0 8px 0;">🎉 StreamLand</h1>
            <p style="margin:0; opacity:0.85;">Teacher Account Approved</p>
          </div>
          <div class="content">
            <h2>Congratulations, ${fullName}!</h2>
            <p>Great news — your teacher account on <strong>StreamLand</strong> has been <strong>reviewed and approved</strong> by our admin team.</p>
            <div style="text-align:center;">
              <span class="badge">✅ Account Approved</span>
            </div>
            <div class="highlight">
              <strong>You can now:</strong>
              <ul style="margin: 8px 0 0 0; padding-left: 20px;">
                <li>Go live and start your first livestream</li>
                <li>Upload course materials and documents</li>
                <li>Connect with students who follow your channel</li>
                <li>Track your audience engagement on the dashboard</li>
              </ul>
            </div>
            <p>Log in now and start your first session — your students are waiting!</p>
            <div style="text-align:center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" class="cta">Go to StreamLand →</a>
            </div>
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              Need help getting started? Reply to this email or visit our support page.
            </p>
            <p style="margin-top: 20px;">Best regards,<br><strong>The StreamLand Team</strong></p>
          </div>
          <div class="footer">
            <p>&copy; 2025 StreamLand. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      if (this.emailProvider === 'smtp') {
        const info = await this.smtpTransporter!.sendMail({
          from: this.fromEmail,
          to: email,
          subject: '🎉 Your Teacher Account Has Been Approved — StreamLand',
          html: htmlContent,
        });
        this.logger.log(`Teacher approval email sent to ${email} (ID: ${info.messageId})`);
        return { success: true, messageId: info.messageId };
      } else if (this.emailProvider === 'resend') {
        const { data, error } = await this.resend!.emails.send({
          from: `StreamLand <${this.fromEmail}>`,
          to: [email],
          subject: '🎉 Your Teacher Account Has Been Approved — StreamLand',
          html: htmlContent,
        });
        if (error) throw new Error(error.message);
        this.logger.log(`Teacher approval email sent to ${email} via Resend (ID: ${data.id})`);
        return { success: true, emailId: data.id };
      }
      return { success: false, error: 'No email provider configured' };
    } catch (error) {
      this.logger.error(`Failed to send teacher approval email to ${email}:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendTeacherRejectionEmail(email: string, fullName: string, reason?: string) {
    if (!this.isConfigured) {
      this.logger.warn(`Email not configured. Skipping teacher rejection email for ${email}`);
      return { success: false, error: 'Email service not configured' };
    }

    const rejectionReason = reason && reason !== 'No reason provided' ? reason : null;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #161853 0%, #292C6D 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .reason-box { background: #fff7ed; border-left: 4px solid #f97316; padding: 16px 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
          .highlight { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0 0 8px 0;">StreamLand</h1>
            <p style="margin:0; opacity:0.85;">Teacher Application Update</p>
          </div>
          <div class="content">
            <h2>Hello, ${fullName}</h2>
            <p>Thank you for applying to become a teacher on <strong>StreamLand</strong>. After careful review, we're unable to approve your application at this time.</p>
            ${rejectionReason ? `
            <div class="reason-box">
              <strong>Reason provided by our team:</strong>
              <p style="margin: 8px 0 0 0;">${rejectionReason}</p>
            </div>
            ` : ''}
            <div class="highlight">
              <strong>What you can do next:</strong>
              <ul style="margin: 8px 0 0 0; padding-left: 20px;">
                <li>Address the feedback above and re-apply</li>
                <li>Ensure your profile and CV are complete and up to date</li>
                <li>Contact our support team if you have questions</li>
              </ul>
            </div>
            <p>We appreciate your interest in teaching on StreamLand and encourage you to apply again once you've had a chance to review the feedback.</p>
            <p style="margin-top: 30px;">Best regards,<br><strong>The StreamLand Team</strong></p>
          </div>
          <div class="footer">
            <p>&copy; 2025 StreamLand. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      if (this.emailProvider === 'smtp') {
        const info = await this.smtpTransporter!.sendMail({
          from: this.fromEmail,
          to: email,
          subject: 'Update on Your Teacher Application — StreamLand',
          html: htmlContent,
        });
        this.logger.log(`Teacher rejection email sent to ${email} (ID: ${info.messageId})`);
        return { success: true, messageId: info.messageId };
      } else if (this.emailProvider === 'resend') {
        const { data, error } = await this.resend!.emails.send({
          from: `StreamLand <${this.fromEmail}>`,
          to: [email],
          subject: 'Update on Your Teacher Application — StreamLand',
          html: htmlContent,
        });
        if (error) throw new Error(error.message);
        this.logger.log(`Teacher rejection email sent to ${email} via Resend (ID: ${data.id})`);
        return { success: true, emailId: data.id };
      }
      return { success: false, error: 'No email provider configured' };
    } catch (error) {
      this.logger.error(`Failed to send teacher rejection email to ${email}:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendPasswordResetOTP(email: string, otp: string, fullName?: string) {
    // Check if email service is configured
    if (!this.isConfigured) {
      this.logger.warn(`❌ Email service not configured. Password reset OTP: ${otp} for ${email}`);
      if (process.env.NODE_ENV === 'development') {
        this.logger.log(`[DEV MODE] Password Reset OTP for ${email}: ${otp}`);
        return { success: true, devMode: true };
      }
      return { 
        success: false, 
        error: 'Email service not configured. Please contact support.' 
      };
    }

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .otp-box { background: white; border: 2px dashed #dc3545; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
            .otp-code { font-size: 32px; font-weight: bold; color: #dc3545; letter-spacing: 8px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .warning { background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>StreamLand</h1>
              <p>Password Reset Request</p>
            </div>
            <div class="content">
              <h2>Hello ${fullName || 'there'}!</h2>
              <p>We received a request to reset your password for your account.</p>
              <p>To continue, please use the OTP code below:</p>
              
              <div class="otp-box">
                <p style="margin: 0; color: #666;">Your OTP code is:</p>
                <div class="otp-code">${otp}</div>
                <p style="margin: 10px 0 0 0; color: #999; font-size: 14px;">Valid for 5 minutes</p>
              </div>

              <div class="warning">
                <strong>Security Warning:</strong>
                <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                  <li>If you did NOT request a password reset, please IGNORE this email</li>
                  <li>Do not share this OTP with anyone</li>
                  <li>Change your password immediately if you think your account is compromised</li>
                </ul>
              </div>

              <p>If you need assistance, please contact us at: <a href="mailto:support@streamland.com">support@streamland.com</a></p>
              
              <p style="margin-top: 30px;">Best regards,<br><strong>The StreamLand Team</strong></p>
            </div>
            <div class="footer">
              <p>&copy; 2025 StreamLand. All rights reserved.</p>
              <p>This is an automated email, please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `;

    try {
      if (this.emailProvider === 'smtp') {
        const info = await this.smtpTransporter!.sendMail({
          from: this.fromEmail,
          to: email,
          subject: 'Password Reset OTP - StreamLand',
          html: htmlContent,
        });

        this.logger.log(`✅ Password reset OTP sent to ${email} via SMTP (ID: ${info.messageId})`);
        return { success: true, messageId: info.messageId };
      } else if (this.emailProvider === 'resend') {
        const { data, error } = await this.resend!.emails.send({
          from: `StreamLand <${this.fromEmail}>`,
          to: [email],
          subject: 'Password Reset OTP - StreamLand',
          html: htmlContent,
        });

        if (error) {
          throw new Error(error.message);
        }

        this.logger.log(`Password reset OTP sent to ${email} via Resend (ID: ${data.id})`);
        return { success: true, emailId: data.id };
      }
    } catch (error) {
      this.logger.error('Failed to send password reset OTP email:');
      this.logger.error(error);
      if (process.env.NODE_ENV === 'development') {
        this.logger.warn(`[DEV MODE] Email exception. Password Reset OTP for ${email}: ${otp}`);
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
    
    // This shouldn't happen, but return error for safety
    return {
      success: false,
      error: 'No email provider configured',
    };
  }
}