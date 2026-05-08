# GharSoch Voice Automation — Full Architecture

## The Big Picture

```mermaid
flowchart TD
    subgraph YOUR_APP["Your App (Azure - gharsoch.tech)"]
        UI["Dashboard UI"]
        API["Next.js API Routes"]
        WH["Vapi Webhook\n/api/vapi/webhook"]
        DB[(MongoDB)]
        OAI["OpenAI GPT-4\n(Post-Call Processing)"]
    end

    subgraph VAPI["Vapi Cloud (Their Servers)"]
        VA1["Sunrise Property Outbound\nAssistant"]
        VA2["Sunrise Property Inbound\nAssistant"]
        VA3["Sunrise Property Reminder\nAssistant"]
        VOICE["Voice Engine\nSTT + TTS"]
    end

    subgraph TWILIO["Twilio (Phone Network)"]
        PHONE["Phone Call\nto Customer"]
    end

    UI -->|"1. Start Campaign"| API
    API -->|"2. POST /call/phone\nwith assistantId"| VA1
    VA1 --> VOICE
    VOICE -->|"3. Connects call"| PHONE
    VOICE -->|"4. Tool-call:\nsearch_properties"| WH
    WH -->|"5. Query"| DB
    DB -->|"6. Results"| WH
    WH -->|"7. Return data"| VOICE
    VOICE -->|"8. Speaks result\nto customer"| PHONE
    VOICE -->|"9. end-of-call-report\n(transcript, recording)"| WH
    WH -->|"10. Process with GPT-4"| OAI
    OAI -->|"11. Extracted data:\nsentiment, score, objections"| WH
    WH -->|"12. Save Call record"| DB
```

---

## Three Call Flows

### Flow 1: Outbound Campaign Call
```mermaid
sequenceDiagram
    participant B as Broker (Dashboard)
    participant A as Your API
    participant V as Vapi Cloud
    participant T as Twilio
    participant L as Lead's Phone
    participant W as Your Webhook
    participant D as MongoDB

    B->>A: Click "Start Campaign"
    A->>D: Fetch leads assigned to campaign
    D-->>A: Lead list (name, phone, budget...)
    
    loop For each lead
        A->>D: Check DNC registry
        D-->>A: Not blocked ✅
        A->>V: POST /call/phone + assistantId + lead context
        V->>T: Initiate outbound call
        T->>L: ☎️ Phone rings
        L-->>V: Answers
        
        Note over V,W: During the call...
        V->>W: tool-call: qualify_lead(budget, timeline)
        W->>D: Save lead qualification
        D-->>W: OK
        W-->>V: Result: "Lead qualified as Hot"
        
        V->>W: tool-call: search_properties(budget, location)
        W->>D: Query properties collection
        D-->>W: 3 matching properties
        W-->>V: Property details
        
        Note over V,L: Sunrise Property pitches properties to lead
        
        V->>W: tool-call: book_appointment(date, property)
        W->>D: Create appointment record
        W-->>V: "Appointment booked for May 5"
        
        Note over V,L: Call ends
        V->>W: end-of-call-report (transcript, recording_url, duration)
        W->>W: GPT-4 extracts sentiment, objections, lead_score
        W->>D: Save full Call record + update Lead
    end
    
    A-->>B: Campaign complete — 45/50 calls made
```

### Flow 2: Inbound Call (Prospect Calls You)
```mermaid
sequenceDiagram
    participant L as Prospect
    participant T as Twilio
    participant V as Vapi Cloud
    participant W as Your Webhook
    participant D as MongoDB

    L->>T: Calls your Twilio number
    T->>V: Routes to Sunrise Property Inbound assistant
    V->>L: "Hello! Welcome to GharSoch..."
    
    Note over V,L: Sunrise Property asks qualification questions
    
    V->>W: tool-call: qualify_lead(name, budget, location, timeline)
    W->>D: Create new Lead record
    D-->>W: Lead created
    W-->>V: "Lead saved"
    
    V->>W: tool-call: search_properties(budget=80L, location=Whitefield)
    W->>D: Query properties
    D-->>W: 2 matching properties
    W-->>V: Property details
    
    Note over V,L: Sunrise Property describes matching properties
    
    V->>W: end-of-call-report
    W->>D: Save Call record
```

### Flow 3: Automated Reminder (Daily 9 AM)
```mermaid
sequenceDiagram
    participant CRON as Scheduler (9 AM IST)
    participant A as Your API
    participant D as MongoDB
    participant V as Vapi Cloud
    participant T as Twilio
    participant L as Lead's Phone

    CRON->>A: Trigger /api/scheduler
    A->>D: Find appointments where date=today AND reminder_sent=false
    D-->>A: 5 appointments found
    
    loop For each appointment
        A->>D: Fetch linked Lead + Property
        A->>V: POST /call/phone + Sunrise Property Reminder assistantId
        V->>T: Initiate call
        T->>L: ☎️ Phone rings
        L-->>V: Answers
        
        Note over V,L: "Hi Rahul, this is Sunrise Property from GharSoch.\nJust confirming your 3 PM visit to\nPrestige Lakeside today."
        
        alt Lead confirms
            V->>A: tool-call: confirm_appointment
            A->>D: Update status = "confirmed"
        else Lead reschedules
            V->>A: tool-call: reschedule_appointment(new_date)
            A->>D: Update scheduled_at + status
        else Lead cancels
            V->>A: tool-call: cancel_appointment
            A->>D: Update status = "cancelled"
        end
        
        A->>D: Set reminder_sent = true
    end
```

---

## Why No VM / Background Server?

| Component | Who Runs It | Cost |
|-----------|-------------|------|
| **Voice Processing** (STT, TTS, call handling) | Vapi's servers | Per-minute billing |
| **Phone Network** (connecting actual calls) | Twilio's servers | Per-minute billing |
| **AI Reasoning** (GPT-4 for tool responses) | OpenAI's servers | Per-token billing |
| **Business Logic** (webhook, CRUD, processing) | Your Next.js on Azure | Already deployed ✅ |
| **Database** (leads, calls, properties) | MongoDB Atlas / Cosmos | Already running ✅ |
| **Scheduler** (9 AM reminders) | Azure App Service cron OR Vapi's built-in scheduler | Free ✅ |

> [!TIP]
> Everything runs **on-demand**. When a call happens, Vapi hits your webhook. Your webhook processes it and responds. No always-on server, no GPU, no VM. Pure serverless.

---

## The Only Setup Required

1. **Create 3 Assistants in Vapi Dashboard** — each with tools and Server URL = `https://gharsoch.tech/api/vapi/webhook`
2. **Get a Twilio number** — import it into Vapi
3. **Set env vars** — `VAPI_ASSISTANT_OUTBOUND_ID`, `VAPI_ASSISTANT_INBOUND_ID`, `VAPI_ASSISTANT_REMINDER_ID`
4. **Build the webhook** — route tool-calls to the right MongoDB operations
