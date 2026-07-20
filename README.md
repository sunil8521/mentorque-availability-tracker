# Mentorque Availability Tracker

A full-stack availability tracking and meeting scheduling application built for the Mentorque platform. This system allows Mentors and Users to declare their weekly availability and enables Administrators to schedule targeted meetings across different time zones.

## Features

*   **Role-Based Access Control:** Distinct interfaces and permissions for `ADMIN`, `MENTOR`, and `USER` roles.
*   **Time Zone Intelligence:** Automatic handling of time zones (IST/UTC/Local) preventing scheduling conflicts across regions.
*   **Availability Dashboards:** Mentors and Users can visualize their week, add available time slots, and specify the type of guidance they need (e.g., Resume Revamp, Mock Interview).
*   **Admin Meeting Scheduling:** Administrators can view all user and mentor availability side-by-side, spot overlaps, and seamlessly book Google Meet sessions.
*   **Modern UI/UX:** A stunning, fully responsive "dark glassmorphism" design built with Tailwind CSS.

## Tech Stack

### Frontend
*   **Framework:** React 18 (via Vite)
*   **Styling:** Tailwind CSS
*   **Routing:** React Router v6
*   **State & Data Fetching:** Custom React Hooks & Fetch API

### Backend
*   **Runtime:** Node.js & Express
*   **Database ORM:** Prisma
*   **Database:** PostgreSQL
*   **Authentication:** JWT (JSON Web Tokens) with Bcrypt password hashing
*   **Validation & Security:** CORS configured for production readiness

## Quick Start (Development)

### 1. Backend Setup
```bash
cd availability-trackerbackend
npm install

# Set up your environment variables
# Create a .env file with DATABASE_URL, DIRECT_URL, and JWT_SECRET

# Push the database schema
npx prisma db push

# (Optional) Seed the database with mock users
# node src/seed.js

# Start the development server
npm run dev
```

### 2. Frontend Setup
```bash
cd availability-trackerfrontend
npm install

# Set up your environment variables
# Create a .env file with VITE_API_URL=http://localhost:5000

# Start the Vite development server
npm run dev
```

## Demo Credentials
If the database has been seeded, you can use the following credentials to explore the different dashboards (Password for all: `password123`):
*   **Admin:** `admin@mentorque.com`
*   **Mentor:** `arjun.patel@mentorque.com`
*   **User:** `amit.kumar@gmail.com`

## Deployment
The application is structured as a monorepo and is fully prepared for deployment on platforms like Render. Ensure you build the Prisma client (`npx prisma generate`) as part of your backend build pipeline.
