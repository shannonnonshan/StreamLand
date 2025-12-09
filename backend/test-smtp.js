const nodemailer = require('nodemailer');
require('dotenv').config();

console.log('🔍 Testing SMTP connection...\n');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false, // true for 465, false for other ports
  requireTLS: true, // Force TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
    ciphers: 'SSLv3',
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
  debug: true, // Show debug logs
  logger: true, // Enable logging
});

console.log('📧 Config:');
console.log(`   Host: ${process.env.SMTP_HOST}`);
console.log(`   Port: ${process.env.SMTP_PORT}`);
console.log(`   User: ${process.env.SMTP_USER}`);
console.log(`   Pass: ${process.env.SMTP_PASS ? '****' + process.env.SMTP_PASS.slice(-4) : 'NOT SET'}`);
console.log('');

// Test 1: Verify connection
console.log('🔐 Test 1: Verifying SMTP connection...');
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP Connection Failed:', error.message);
    console.error('\n📋 Troubleshooting:');
    console.error('   1. Check if Gmail App Password is correct');
    console.error('   2. Make sure 2-Step Verification is enabled in Google Account');
    console.error('   3. Verify App Password was generated correctly');
    console.error('   4. Check if "Less secure app access" is disabled (should use App Password instead)');
    process.exit(1);
  } else {
    console.log('✅ SMTP Connection Successful!');
    console.log('   Server is ready to send emails');
    
    // Test 2: Send test email
    console.log('\n📨 Test 2: Sending test email...');
    const mailOptions = {
      from: `"StreamLand Test" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER, // Send to self
      subject: 'SMTP Test - StreamLand',
      html: `
        <h1>✅ SMTP Configuration Successful!</h1>
        <p>Your email service is working correctly.</p>
        <p><strong>Configuration:</strong></p>
        <ul>
          <li>Host: ${process.env.SMTP_HOST}</li>
          <li>Port: ${process.env.SMTP_PORT}</li>
          <li>User: ${process.env.SMTP_USER}</li>
          <li>TLS: Enabled</li>
        </ul>
        <p>You can now deploy to Render with confidence! 🚀</p>
      `,
    };
    
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('❌ Failed to send test email:', error.message);
        process.exit(1);
      } else {
        console.log('✅ Test email sent successfully!');
        console.log(`   Message ID: ${info.messageId}`);
        console.log(`   Response: ${info.response}`);
        console.log('\n🎉 All tests passed! Ready for Render deployment.');
        process.exit(0);
      }
    });
  }
});
