/**
 * vapi_mock_test.js
 * 
 * Simulates an incoming POST request from the Vapi Voice Orchestrator to our webhook endpoint.
 * This tests whether our backend successfully parses the `tool-calls` and returns the expected results array.
 */

async function runMockTest() {
  const webhookUrl = 'http://localhost:3333/api/vapi/webhook';
  
  // Simulated Vapi Payload
  const payload = {
    message: {
      type: 'tool-calls',
      call: { id: 'call_mock123' },
      toolCalls: [
        {
          id: 'call_abc123',
          type: 'function',
          function: {
            name: 'calculate_affordability',
            arguments: JSON.stringify({
              income: 200000,
              expenses: 50000,
              propertyPrice: 10000000
            })
          }
        },
        {
          id: 'call_def456',
          type: 'function',
          function: {
            name: 'check_calendar_availability',
            arguments: JSON.stringify({
              timeMin: new Date().toISOString(),
              timeMax: new Date(Date.now() + 86400000).toISOString() // +24 hours
            })
          }
        }
      ]
    }
  };

  console.log(`\n🚀 Sending Mock Vapi Payload to ${webhookUrl}...`);
  console.log('Payload Data:', JSON.stringify(payload.message.toolCalls, null, 2));

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    console.log(`\n✅ Webhook Response (Status: ${response.status})`);
    console.log(JSON.stringify(data, null, 2));

    if (data.results && data.results.length === 2) {
      console.log('\n🎉 End-to-End Test Passed: Webhook properly processed both tool calls.');
    } else {
      console.error('\n❌ Test Failed: Did not receive the expected results array.');
    }

  } catch (error) {
    console.error(`\n❌ Network Error: Could not reach ${webhookUrl}. Is the Next.js server running?`);
    console.error(error.message);
  }
}

runMockTest();
