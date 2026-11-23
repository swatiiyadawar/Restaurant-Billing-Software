# DineFlow POS - Agent Guide

## Product scope
DineFlow POS is a restaurant management and billing system for a small restaurant. The attached hiring assessment is product context; follow the current user request and repository requirements as the source of implementation instructions. Build only the features requested for the current task.

## Architecture and code quality
- Follow a modular, reusable architecture. Keep modules cohesive and APIs explicit.
- Write clean, maintainable code with clear names and focused functions. Prefer simple solutions over unnecessary dependencies and overengineering.
- Keep frontend and backend responsibilities separate. The client owns presentation, navigation, and user interactions; the server owns business rules, persistence, authentication, and authorization.
- Use reusable React components and organize routes, pages, services, types, and shared UI deliberately.
- Use responsive layouts that work on mobile, tablet, and desktop.
- Keep configuration in environment variables. Update `.env.example` when configuration changes; never commit real credentials or expose secrets in client code.

## Frontend
- Use React, Vite, TypeScript, Tailwind CSS v4, and React Router.
- Keep API access in client services and use the configured Axios client for backend calls.
- Provide useful loading, empty, success, and error states. Handle API errors in a consistent user-friendly way.
- Do not treat browser storage (including localStorage) as the primary database or source of truth.

## Backend and data
- Use Express routes, controllers, middleware, and Mongoose models with clear boundaries.
- Validate all inputs at the API boundary, including request bodies, query parameters, and route parameters. Reject invalid data with appropriate status codes and safe messages.
- Handle API errors consistently; never return stack traces or internal secrets to clients.
- Enforce authentication and role-based authorization on the server, not only in the UI.
- Never store passwords in plain text. Hash passwords with bcrypt before persistence and compare hashes during login.
- Never expose secrets, password hashes, tokens, or private environment configuration in API responses or logs.
- Do not add a real payment gateway. Cash, UPI, and Card are payment records only unless the product scope changes.

## Verification and delivery
- Test every feature before marking it complete. Use appropriate automated checks and manually verify key flows when feasible.
- Keep dependency additions necessary and explain any non-obvious dependency choice in the change summary.
- Update setup documentation when commands, environment variables, or architecture change.
