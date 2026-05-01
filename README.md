# Arya Voice Agent - Real Estate Broker Assistant

A comprehensive voice-powered real estate lead management and engagement platform designed to help brokers automate and streamline their business operations.

## Table of Contents
- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Data Models](#data-models)
- [Getting Started](#getting-started)
- [Usage Guide](#usage-guide)
- [Tech Stack](#tech-stack)

## Project Overview

Arya is an intelligent voice agent system that assists real estate brokers by automating lead qualification, outbound calling, appointment scheduling, and reminders. The platform uses AI-powered voice agents to interact with prospects, qualify leads, and manage the entire customer journey.

### Core Voice Agents

1. **Arya - Outbound Agent**
   - Conducts cold calls to leads
   - Follows configured scripts
   - Handles property pitches
   - Manages objection handling
   - Books appointments
   - Logs call dispositions
   - Adheres to TRAI DND compliance

2. **Arya - Inbound Agent**
   - Handles incoming prospect calls
   - Qualifies leads by collecting:
     - Budget range
     - Location preferences
     - Timeline
     - Property type preferences
   - Creates/updates lead records
   - Routes hot leads to human agents

3. **Arya - Reminder Agent**
   - Makes reminder calls for scheduled site visits
   - Confirms, reschedules, or cancels appointments
   - Updates appointment statuses
   - Scheduled daily at 9:00 AM IST

## Key Features

### 📊 Dashboard
- Overview of leads, campaigns, calls, and appointments
- Real-time metrics and activity feed
- Quick access to key functions

### 👥 Leads Management
- Create and manage lead profiles
- Track lead status and qualification
- Record customer requirements and preferences
- Manage follow-up schedules
- Lead scoring and interest level tracking

### 📞 Campaigns
- Create and manage outbound calling campaigns
- Assign target leads to campaigns
- Configure script templates
- Track campaign performance

### 📋 Call Logs
- Complete call history with recordings
- Call transcripts and summaries
- Disposition tracking
- Customer availability and callback preferences
- Objection tracking

### 🏠 Properties Management
- Manage property listings
- Track property details (price, location, type, amenities)
- Property status management

### 📅 Appointments
- Schedule site visits and meetings
- Track appointment statuses
- Send automated reminders
- Manage rescheduling and cancellations

### 📈 Analytics
- Call performance metrics
- Conversion rates
- Campaign effectiveness
- Lead funnel analysis

### ⚙️ Settings
- DNC (Do Not Call) registry management
- User preferences
- System configuration

## System Architecture

### Frontend Structure
```
app/
├── api/                    # API routes
│   ├── activities/
│   ├── agent/
│   ├── appointments/
│   ├── auth/
│   ├── call-responses/
│   ├── calls/
│   ├── campaigns/
│   ├── conversation-history/
│   ├── dnc/
│   ├── follow-ups/
│   ├── health/
│   ├── leads/
│   ├── properties/
│   ├── rag/
│   ├── scheduler/
│   └── upload/
├── sections/               # UI sections
│   ├── AnalyticsSection.tsx
│   ├── AppointmentsSection.tsx
│   ├── AuthScreen.tsx
│   ├── CallLogsSection.tsx
│   ├── CampaignsSection.tsx
│   ├── DashboardSection.tsx
│   ├── Header.tsx
│   ├── LeadsSection.tsx
│   ├── PropertiesSection.tsx
│   ├── SettingsSection.tsx
│   ├── Sidebar.tsx
│   ├── VoiceCallModal.tsx
│   └── VoiceSessionProvider.tsx
├── layout.tsx
└── page.tsx

components/                 # UI components
└── ui/                     # shadcn/ui components

hooks/                      # Custom hooks
lib/                        # Utility libraries
models/                     # Data models
response_schemas/           # Agent response schemas
```

## Data Models

### Lead
```typescript
{
  name: string
  phone: string
  email: string
  source: string
  status: string (default: 'new')
  budget_range: string
  location_pref: string
  property_type: string
  assigned_agent_id: string
  dnd_status: boolean (default: false)
  place: string (default: 'Mumbai')
  notes: string
  preferred_contact_time: string
  availability_window: string
  availability_days: string[]
  interest_level: string (default: 'unknown')
  qualification_status: string (default: 'unqualified')
  lead_score: number (default: 0)
  last_contacted_at: Date
  next_follow_up_date: Date
  follow_up_count: number (default: 0)
  total_calls: number (default: 0)
  first_call_completed: boolean (default: false)
  customer_requirements: string
  timeline: string
  objections: string
}
```

### Property
```typescript
{
  title: string
  type: string
  location: string
  price: number
  area_sqft: number
  bedrooms: number
  status: string (default: 'available')
  builder: string
  images: string[]
  description: string
}
```

### Appointment
```typescript
{
  lead_id: string
  property_id: string
  agent_id: string
  scheduled_at: Date
  status: string (default: 'scheduled')
  reminder_sent: boolean (default: false)
  notes: string
}
```

### Campaign
```typescript
{
  name: string
  description: string
  script_template: string
  target_lead_ids: string[]
  status: string (default: 'draft')
  assigned_agent_ids: string[]
  start_date: Date
  end_date: Date
}
```

### Call
```typescript
{
  lead_id: string
  lead_name: string
  lead_phone: string
  agent_name: string
  agent_id: string
  campaign_id: string
  direction: string
  call_type: string (default: 'outbound')
  duration: number
  disposition: string
  call_outcome: string
  call_summary: string
  customer_availability: string
  preferred_callback_time: string
  preferred_callback_days: string[]
  customer_interest_level: string
  follow_up_required: boolean (default: false)
  follow_up_date: Date
  follow_up_notes: string
  key_requirements: string
  customer_objections: string
  next_steps: string
  recording_url: string
  transcript: string
  trai_compliant: boolean (default: true)
  call_status: string (default: 'completed')
}
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- MongoDB database
- Lyzr API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd arya_voice_agent
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   
   Create a `.env.local` file in the root directory:
   ```env
   LYZR_API_KEY=your-lyzr-api-key-here
   DATABASE_URL=mongodb://localhost:27017/arya-voice-agent
   APP_JWT_SECRET=your-jwt-secret-here
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:3333`

### Build for Production
```bash
npm run build
npm start
```

## Usage Guide

### Setting Up Your First Campaign

1. **Add Leads**
   - Navigate to Leads section
   - Click "Add Lead"
   - Fill in lead details (name, phone, source, etc.)

2. **Create Properties**
   - Go to Properties section
   - Add property listings with details and images

3. **Launch a Campaign**
   - Navigate to Campaigns
   - Create a new campaign
   - Assign target leads
   - Configure script template
   - Start outbound calls

### Making Voice Calls

1. **Outbound Calls**
   - From Leads section, click "Call" on any lead
   - Or from Campaigns, start an outbound campaign
   - Arya - Outbound Agent will handle the conversation

2. **Appointment Reminders**
   - From Appointments section, select an appointment
   - Click "Send Reminder"
   - Arya - Reminder Agent will call the lead

## Tech Stack

- **Framework**: Next.js 14.2.23
- **Language**: TypeScript 5.6.2
- **UI Components**: shadcn/ui, Radix UI
- **Styling**: Tailwind CSS 3.4.11
- **Icons**: Lucide React
- **Forms**: React Hook Form, Zod
- **Charts**: Recharts
- **Database**: MongoDB (via lyzr-architect)
- **AI Agents**: Lyzr Platform
- **Voice**: OpenAI GPT-4.1

## License

This project is licensed under the MIT License.
