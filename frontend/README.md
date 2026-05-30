This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Quick Start (StreamLand frontend)

1. Install dependencies

```bash
cd frontend
npm install
```

2. Create a `.env` file with at least the following variables:

```
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_SOCKET_URL="http://localhost:3001"
NEXT_PUBLIC_WEBRTC_STUN_URLS="stun:stun.l.google.com:19302"
```

3. Run the development server

```bash
npm run dev
```

4. Build for production

```bash
npm run build
npm start
```

## Environment variables

- `NEXT_PUBLIC_API_URL` — Backend API base URL (e.g. `http://localhost:3001`).
- `NEXT_PUBLIC_SOCKET_URL` — Socket.IO server URL.
- `NEXT_PUBLIC_WEBRTC_STUN_URLS` — Comma-separated STUN server URLs.
- `NEXT_PUBLIC_WEBRTC_TURN_URLS` (optional) — TURN server(s) for production.

## Deploy

- Vercel: Connect repository to Vercel and set environment variables in the Vercel dashboard.
- Docker: Create a simple Dockerfile if you need containerized frontend deployments.

## Key paths (frontend)

- `frontend/src/` — application code: pages, components, hooks, contexts, and styles.
- `frontend/public/` — static assets served by Next.js (images, admin assets).
- `frontend/package.json` — frontend scripts and dependencies.
- `frontend/next.config.ts` — Next.js configuration specific to the project.


