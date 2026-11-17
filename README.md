# Mate — Interview Slot Booking

An interview-ready MERN-style assessment project with a polished HR workspace, candidate booking flow, JWT authentication, bcrypt password hashing, MongoDB-ready data models, and Socket.io events for live slot availability.

## Run locally

The included Node runtime is in `nodejs/node-v26.13.1-win-x64`. In PowerShell:

```powershell
.\\npm.cmd run dev
```

Open the local URL Vite prints. For the API, run `.\\node.cmd server.js` in another terminal. The UI ships with realistic seeded demo data so it can be reviewed without a database first.

Firebase CLI commands use the project-local launcher: `.\\firebase.cmd login`, then `.\\firebase.cmd deploy --only firestore`.

## API and realtime contract

`POST /api/auth/register`, `POST /api/auth/login`, `GET /api/slots`, `POST/PATCH/DELETE /api/slots`, `POST /api/bookings`, `GET /api/bookings`, and `PATCH /api/bookings/:id/cancel` are implemented. Protected operations use `Authorization: Bearer <jwt>`.

Socket.io events: `slots-snapshot`, `slot-updated`, `slot-booked`, `slot-full`, and `slot-cancelled`. The booking handler validates capacity, duplicate booking, and seat availability before broadcasting updates.

The browser config in `firebase-client.mjs` is retained for the supplied Firebase project. Firebase can be used for client analytics while the booking API remains controlled by the Node service.
