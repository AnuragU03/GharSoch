$apiKey = "6044d7e6-e686-46c4-829c-787cd3c8b43d" # Replace this!

$headers = @{
    "Authorization" = "Bearer $apiKey"
    "Content-Type"  = "application/json"
}

$body = @{
    phoneNumberId = "3066afff-0894-4f5e-a42a-750e3cecd59b"
    customer      = @{
        number = "+919141063645"
    }
    assistant     = @{
        firstMessage = "Hello! This is GharSoch calling to test the new Vapi and Exotel connection. How are you doing today?"
        model        = @{
            provider = "openai"
            model    = "gpt-4"
            messages = @(
                @{
                    role    = "system"
                    content = "You are a helpful real estate assistant for GharSoch."
                }
            )
        }
    }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "https://api.vapi.ai/call/phone" -Method Post -Headers $headers -Body $body
