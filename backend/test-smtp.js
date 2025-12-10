const { Resend } = require('resend');
require('dotenv').config();

console.log('🔍 Testing Resend API...\n');

const resend = new Resend(process.env.RESEND_API_KEY);

console.log('📧 Config:');
console.log(`   API Key: ${process.env.RESEND_API_KEY ? '****' + process.env.RESEND_API_KEY.slice(-8) : 'NOT SET'}`);
console.log(`   From Email: ${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}`);
console.log(`   Test To: ${process.env.TEST_EMAIL || 'Enter your email in .env as TEST_EMAIL'}`);
console.log('');

// Test: Send test email
console.log('📨 Sending test email...');

const testEmail = async () => {
  const testRecipient = process.env.TEST_EMAIL;
  
  if (!testRecipient) {
    console.error('❌ Error: TEST_EMAIL not set in .env file');
    console.error('   Add TEST_EMAIL=your-email@example.com to .env');
    process.exit(1);
  }

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: [testRecipient],
      subject: 'Resend Test - StreamLand',
      html: `
        <h1>✅ Resend Configuration Successful!</h1>
        <p>Your email service is working correctly.</p>
        <p><strong>Configuration:</strong></p>
        <ul>
          <li>Provider: Resend</li>
          <li>From: ${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}</li>
          <li>API: HTTP (works on Render!)</li>
        </ul>
        <p>You can now deploy to Render with confidence! 🚀</p>
      `,
    });

    if (error) {
      console.error('❌ Failed to send test email:', error);
      console.error('\n📋 Troubleshooting:');
      console.error('   1. Check if RESEND_API_KEY is correct');
      console.error('   2. Verify API key at https://resend.com/api-keys');
      console.error('   3. Make sure you have emails remaining in your quota');
      process.exit(1);
    }

    console.log('✅ Test email sent successfully!');
    console.log(`   Email ID: ${data?.id}`);
    console.log('\n🎉 All tests passed! Ready for Render deployment.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

testEmail();
