# Smart Career Management System (SCMS)

SCMS is a full-stack platform for managing student career workflows, organization document generation, approvals, and public verification of issued certificates and offer letters.

## Tech Stack

### Backend
- NestJS
- TypeScript
- Prisma ORM
- MySQL
- JWT + Passport
- Swagger

### Frontend
- Next.js App Router
- TypeScript
- Tailwind CSS

## Project Overview

The platform supports three primary roles:
- Student: manage profile, resume, portfolio, and AI-assisted content
- Organization: manage templates, generate certificates and offer letters, and review verification IDs
- Super Admin: approve or reject organizations, manage users, view analytics, and inspect audit logs

## Installation

### 1. Backend
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run start:dev
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

## How to Run

### Backend
- Runs on: http://localhost:3000
- Swagger docs: http://localhost:3000/api-docs

### Frontend
- Runs on: http://localhost:3001

## Default Login Credentials

- Super Admin
  - Email: admin@scms.com
  - Password: Password123!

- Organization
  - Email: approved-org@scms.com
  - Password: Password123!

- Student
  - Email: student1@scms.com
  - Password: Password123!

## Key Features

- Role-based access control with JWT
- Student profile, resume, and portfolio workflows
- Organization certificate and offer letter generation
- Bulk document generation
- Public verification page for documents
- Admin approval workflow for organizations
- Audit logs and analytics dashboard

## API Documentation

Swagger UI is exposed at:
- http://localhost:3000/api-docs

## Final Project Checklist

- [ ] Backend running on port 3000
- [ ] Frontend running on port 3001
- [ ] Swagger docs accessible at /api-docs
- [ ] Database seeded with test data
- [ ] All 3 roles can log in
- [ ] Student can generate portfolio
- [ ] Organization can generate certificate
- [ ] Super Admin can approve orgs
- [ ] Public verification works

## Viva Preparation Notes

### 1. Tech Stack Choices
- NestJS provides a structured backend with controllers, services, DTOs, guards, and Swagger support.
- Prisma ORM keeps data access type-safe and simple for schema-driven database operations.
- Next.js App Router was chosen for the frontend to provide a clean route-based UI with strong TypeScript support.
- Tailwind CSS enables fast, consistent, and professional UI styling.

### 2. JWT Authentication Flow
- The user logs in with email/password.
- The backend validates credentials, compares the password hash, and issues a JWT access token plus refresh token.
- The frontend stores the token in local storage and includes it in the Authorization header for protected requests.
- Protected routes and controllers use guards to validate the token before allowing access.

### 3. RBAC Implementation
- Roles are stored in the Prisma Role model with distinct values for SUPER_ADMIN, ORGANIZATION, and STUDENT.
- Permission metadata and guards ensure endpoints are only accessible to authorized roles.
- The admin organization pages, student pages, and organization pages are separated by role-aware navigation and guarded routes.

### 4. Database Relationships
- Users link to exactly one role.
- Each student is linked to a user record and optionally to one organization.
- Organizations own templates and issued documents.
- Certificates and offer letters tie together students, organizations, and template definitions.
- Activity logs, notifications, and verification records support auditing and public document trust.

### 5. AI Integration Approach
- The current system uses a lightweight mock AI pattern for portfolio generation and resume parsing.
- The UI calls backend endpoints that return generated content and simulated AI responses, which is suitable for an MVP and keeps the project fast to deliver.
- This approach is easy to replace later with a real LLM or external AI service.

### 6. Document Verification System
- Each generated document has a unique verification ID.
- The verification ID is stored in a dedicated verification record so it can be queried publicly.
- The public /verify/[id] page performs a lookup and shows either a verified document card or an invalid/expired error state.
