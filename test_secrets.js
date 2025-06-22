// Test script to verify Z-API secrets are loaded
console.log('Testing environment variables:');
console.log('ZAPI_INSTANCE_ID:', process.env.ZAPI_INSTANCE_ID ? 'FOUND' : 'NOT FOUND');
console.log('ZAPI_TOKEN:', process.env.ZAPI_TOKEN ? 'FOUND' : 'NOT FOUND');
console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'FOUND' : 'NOT FOUND');
console.log('OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? 'FOUND' : 'NOT FOUND');

if (process.env.ZAPI_INSTANCE_ID) {
  console.log('ZAPI_INSTANCE_ID length:', process.env.ZAPI_INSTANCE_ID.length);
}

if (process.env.ZAPI_TOKEN) {
  console.log('ZAPI_TOKEN length:', process.env.ZAPI_TOKEN.length);
}