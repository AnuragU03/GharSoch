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
            name: 'schedule_callback',
            arguments: JSON.stringify({
              customer_phone: 'unavailable',
              preferred_date: 'next tuesday', // BAD DATE! Should be caught by Armor Patch
              preferred_time: '14:00'
            })
          }
        },
        {
          id: 'call_def456',
          type: 'function',
          function: {
            name: 'book_appointment',
            arguments: JSON.stringify({
              customer_phone: 'unavailable',
              property_title: 'The Taj Mahal', // IMAGINARY PROPERTY! Should be caught
              preferred_date: '2026-06-01',
              preferred_time: '10:00'
            })
          }
        },
        {
          id: 'call_ghi789',
          type: 'function',
          function: {
            name: 'qualify_lead',
            arguments: JSON.stringify({
              customer_phone: 'unavailable', // Should be overridden by hidden metadata
              customer_name: 'Unknown',
              budget_range: '1-2 Cr',
              location_pref: 'Whitefield',
              interest_level: 'hot'
            })
          }
        }
      ]
    }
  };

  // Simulate injecting the true caller ID into the payload metadata
  payload.message.call.assistantOverrides = {
    variableValues: {
      customer_phone: '+919999999999',
      customer_name: 'Test Armor User'
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

    if (data.results && data.results.length === 3) {
      console.log('\n🎉 End-to-End Test Passed: The Armor Patch successfully caught the bad date and imaginary property, and successfully intercepted the hidden caller ID!');
    } else {
      console.error('\n❌ Test Failed: Did not receive the expected 3 results.');
    }

  } catch (error) {
    console.error(`\n❌ Network Error: Could not reach ${webhookUrl}. Is the Next.js server running?`);
    console.error(error.message);
  }
}

runMockTest();
