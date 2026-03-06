# ✦ Nakshatra AI — Backend

> Node.js REST API · Swiss Ephemeris · Google Gemini · Supabase · Razorpay

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat&logo=node.js)
![Render](https://img.shields.io/badge/Deployed-Render-46e3b7?style=flat)

---

## What Does This Server Do?

1. Receives birth details from the frontend
2. Geocodes location to latitude/longitude via OpenCage
3. Calculates Vedic birth chart via Swiss Ephemeris
4. Stores the chart in Supabase database
5. Sends chart + question to Google Gemini AI
6. Returns AI prediction to the user
7. Manages prepaid credits and Razorpay payments

## Architecture

```
React Frontend
      ↓
Express Server  ← this repo
  ↓        ↓        ↓        ↓
Swiss    Gemini  Supabase  Razorpay
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Server status |
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Login, get token |
| POST | /api/chart/generate | Generate birth chart |
| GET | /api/chart/me | Fetch saved chart |
| GET | /api/chart/horoscope | Daily horoscope |
| POST | /api/ai/ask | Ask AI (1 credit) |
| GET | /api/ai/history | Chat history |
| POST | /api/payment/create-order | Razorpay order |
| POST | /api/payment/verify | Verify + add credits |
| GET | /api/user/profile | User profile |
| GET | /api/user/credits | Credit balance |

## Folder Structure

```
nakshatra-backend/
├── server.js
├── package.json
├── routes/         auth.js, chart.js, ai.js, payment.js, user.js
├── services/       ephemerisService.js, geocodingService.js, aiService.js, dbService.js
├── middleware/     auth.js
└── config/         database.sql
```

## Database Tables (run database.sql in Supabase once)

- users — accounts, credits, subscription
- charts — birth chart data
- chat_logs — AI questions and answers
- transactions — payment history

## Credit Plans

| Plan | Credits | Price |
|------|---------|-------|
| Seeker | 5 questions | Rs 99 |
| Devotee | 20 questions | Rs 299 |
| Sage | Unlimited 30 days | Rs 999 |

## Deploy to Render

1. Push this repo to GitHub
2. render.com → New Web Service → connect repo
3. Build Command: npm install
4. Start Command: node server.js
5. Add environment variables in Render dashboard
6. Deploy

## Related
- Frontend: https://github.com/YOUR_USERNAME/nakshatra-frontend

© 2024 Nakshatra AI — Private
