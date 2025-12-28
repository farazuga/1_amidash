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

## Active Campaign Integration

The project form integrates with Active Campaign CRM for client and contact lookup.

### Setup

1. Get your Active Campaign API credentials:
   - Log into your Active Campaign account
   - Go to Settings > Developer
   - Copy your Account Name (the subdomain, e.g., "mycompany" from mycompany.activehosted.com)
   - Copy your API Key

2. Add environment variables to `.env.local`:
   ```bash
   ACTIVECAMPAIGN_ACCOUNT_NAME=your-account-name
   ACTIVECAMPAIGN_API_KEY=your-api-key
   ```

### Features

- **Client Name Autocomplete**: Type 2+ characters to search Active Campaign accounts
- **Contact Auto-fill**: Contacts are loaded and auto-filled when an account is selected
- **Contact Navigation**: Use prev/next arrows to cycle through multiple contacts
- **AC Link**: Direct link to the AC account page appears after selection
- **Manual Override**: All auto-filled values can be edited freely
- **Secondary POC**: Email-only selection from AC contacts

### API Rate Limits

Active Campaign has a rate limit of 5 requests/second. The integration includes:
- Client-side debouncing (300ms)
- Server-side authentication to prevent abuse

### Graceful Degradation

If Active Campaign credentials are not configured:
- The Client Name field works as a normal text input
- POC fields work as normal text inputs
- No AC-specific UI elements are shown

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
