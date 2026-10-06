# Labour Platform Administration & Developer Console (Standalone PWA)

This is the standalone **Progressive Web App (PWA)** for the **Labour Educational System Platform Administration**. It contains the entire Super Admin Operations Center and Platform Developer Portal extracted from the School Educational Report System.

---

## 🚀 Quick Setup Instructions

### 1. Move to Your Desired Location
You can **cut this entire folder (`PLATFORM_ADMIN_STANDALONE_PROJECT`)** and paste it wherever you want (for instance: `c:\Users\MR. RAY\Desktop\labour-platform-admin` or into a new GitHub repository).

### 2. Install Dependencies
Open your terminal inside this folder and run:
```bash
npm install
```

### 3. Configure Environment Variables
Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```
Fill in the exact same Supabase credentials you use for your school database:
```ini
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_PAYSTACK_PUBLIC_KEY=pk_live_your_paystack_key
VITE_SCHOOL_PORTAL_URL=https://app.laboureducation.com
```

### 4. Start Local Development Server
```bash
npm run dev
```
Open `http://localhost:5174` in your browser.

---

## 📱 Features Included

- **Platform Operations Center (`/platform/operations`):**
  - Live System Telemetry & Operations Dashboard
  - School Directory & Detailed School Inspection View
  - GES Radar / Education News Feed Watcher
  - Global Broadcasts Announcements Manager
  - Support Tickets & Helpdesk Center
  - Paystack Subscriptions, Wallet Transactions & Billing Audit
  - Referral & Rewards Management Dashboard
  - Academic Calendar Distribution
  - Blog & User Manuals CMS
  - Intervention Sessions & Remote Audit Log
  - Cross-School Aggregate Analytics & Terminal Reports
  - AI Operations Assistant & Runbook

- **Platform Developer Portal (`/platform/developer`):**
  - API Keys Management & Rate Limiting
  - API Interactive Documentation Center (REST OpenAPI spec)
  - API Versioning & Deprecation Lifecycle Manager
  - Real-time Webhooks & Delivery Logs
  - Interactive API Sandbox Testbench
  - API Traffic & Usage Analytics
  - Cryptographic Security Center & Hash Tools
  - Official Client SDKs Download Center

- **PWA Installation:**
  - Installs as a standalone native app on Windows, macOS, Android, and iOS using `vite-plugin-pwa`.

---

## 🔐 Authentication & Access

- Access to all routes is guarded by `SuperAdminRoute`.
- Only accounts with `role: 'super_admin'`, `role: 'platform_developer'`, or matching your configured master developer email will be granted entry.
- Initial super admin setup can be executed via `/register`.

---

## 🌐 Production Deployment

To build for production:
```bash
npm run build
```
The compiled files in `dist/` can be deployed to:
- **Netlify**: Run `npx netlify deploy --prod --dir=dist` or link to GitHub.
- **Vercel**: Run `vercel --prod`.
- Recommended production domain: `admin.laboureducation.com` or `ops.laboureducation.com`.
