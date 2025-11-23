import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST'),
      port: this.configService.get('SMTP_PORT'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    });
  }

  async sendOTP(email: string, otp: string, fullName?: string) {
    const mailOptions = {
      from: `"StreamLand" <${this.configService.get('SMTP_USER')}>`,
      to: email,
      subject: 'Account Verification OTP - StreamLand',
      html: `
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
              <h1>✨ StreamLand</h1>
              <p>Leading Online Learning Platform</p>
            </div>
            <div class="content">
              <h2>Hello ${fullName || 'there'}! 👋</h2>
              <p>Thank you for registering an account at <strong>StreamLand</strong>.</p>
              <p>To complete your registration, please use the OTP code below:</p>
              
              <div class="otp-box">
                <p style="margin: 0; color: #666;">Your OTP code is:</p>
                <div class="otp-code">${otp}</div>
                <p style="margin: 10px 0 0 0; color: #999; font-size: 14px;">Valid for 5 minutes</p>
              </div>

              <div class="warning">
                <strong>⚠️ Important:</strong>
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
              <p>© 2025 StreamLand. All rights reserved.</p>
              <p>This is an automated email, please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`OTP email sent successfully to ${email}`);
      return { success: true };
    } catch (error) {
      console.error('Failed to send OTP email:', error);
      // Don't throw error, just log it (registration should still succeed)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendPasswordResetOTP(email: string, otp: string, fullName?: string) {
    const mailOptions = {
      from: `"StreamLand" <${this.configService.get('SMTP_USER')}>`,
      to: email,
      subject: 'Password Reset OTP - StreamLand',
      html: `
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
              <h1>🔐 StreamLand</h1>
              <p>Password Reset Request</p>
            </div>
            <div class="content">
              <h2>Hello ${fullName || 'there'}! 👋</h2>
              <p>We received a request to reset your password for your account.</p>
              <p>To continue, please use the OTP code below:</p>
              
              <div class="otp-box">
                <p style="margin: 0; color: #666;">Your OTP code is:</p>
                <div class="otp-code">${otp}</div>
                <p style="margin: 10px 0 0 0; color: #999; font-size: 14px;">Valid for 5 minutes</p>
              </div>

              <div class="warning">
                <strong>⚠️ Security Warning:</strong>
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
              <p>© 2025 StreamLand. All rights reserved.</p>
              <p>This is an automated email, please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Password reset OTP email sent successfully to ${email}`);
      return { success: true };
    } catch (error) {
      console.error('Failed to send password reset OTP email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
