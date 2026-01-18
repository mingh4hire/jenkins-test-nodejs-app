// Simple test file
console.log('Running tests...');

function testAddition() {
  const result = 2 + 2;
  if (result !== 4) {
    throw new Error('Addition test failed!');
  }
  console.log('✓ Addition test passed');
}

function testMessageFormat() {
  const message = 'Hello from Jenkins deployed Node.js app!';
  if (!message.includes('Jenkins')) {
    throw new Error('Message format test failed!');
  }
  console.log('✓ Message format test passed');
}

try {
  testAddition();
  testMessageFormat();
  console.log('\nAll tests passed! ✓');
  process.exit(0);
} catch (error) {
  console.error('\nTest failed:', error.message);
  process.exit(1);
}
