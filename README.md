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

## AlgaeTree device contract

The singular dashboard resolves devices from the current Firebase RTDB roots:

- `AlgaeTree/<DEVICE_ID>` for commercial units
- `HomeAlgaeTree/<DEVICE_ID>` for home display and compact units

The older `AlgeeTree` and `AiAlgeeTree` roots remain read-compatible during the
migration. Device family and available controls are derived from the resolved
root and the keys present in the live record; the UI must not infer hardware
only from the device ID.

Device commands go through `POST /api/device-control`. A command request contains
the device ID, command code, and a flattened `updates` object. The server verifies
the model, live hardware keys, online heartbeat, pending-command state, and any
required device password, then sends the field updates and `Change` in one atomic
multi-path RTDB `PATCH`. It waits up to three seconds for the device to acknowledge
the command by returning `Change` to `0`. Only one command may be pending unless
the caller explicitly confirms an overwrite.

Current command codes are: restart `1`, Wi-Fi module restart `2`, factory reset
`3`, Wi-Fi change `4`, clock sync `6`, pump timings `7`/`8`, sensor test or home
PIN `9`, LED intensities `10`, air-pump intensities `12`, filling `13`, pumps
`14`/`15`, camera `16`, LEDs `17`–`20`, fans `21`/`22`, power saving `23`, refresh
`24`, and commercial CO2 calibration `25`.

Online state is determined from `LastOnline.Date` and `LastOnline.Time` in IST.
A device is online only while that heartbeat is no more than 11 minutes old.
Offline readings stay visible, but control actions are disabled.

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
