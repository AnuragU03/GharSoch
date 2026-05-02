/**
 * vapi_mock_test.js
 * 
 * Simulates an incoming POST request from the Vapi Voice Orchestrator to our webhook endpoint.
 * This tests whether our backend successfully parses the `tool-calls` and returns the expected results array.
 */

async function runMockTest() {
  const webhookUrl = 'http://localhost:3333/api/vapi/webhook';
  
  // Simulated Vapi Payload for Arya tools
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
              monthly_income: 200000,
              existing_emis: 50000,
              monthly_expenses: 40000,
              property_price: 15000000,
              down_payment: 3000000
            })
          }
        },
        {
          id: 'call_def456',
          type: 'function',
          function: {
            name: 'search_properties',
            arguments: JSON.stringify({
              location: 'Whitefield',
              bedrooms: 2,
              budget_max: 20000000
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
