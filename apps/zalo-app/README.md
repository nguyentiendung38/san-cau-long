# Zalo Mini App

## Development

The Mini App reads its API base URL from `VITE_API_URL`. For local development it
defaults to `http://127.0.0.1:3005/api`; for a deployed build, configure this
variable to the publicly reachable backend URL, including `/api` (for example,
`https://example.edu.vn/api`). A deployed Mini App must not use a localhost URL.

In production, set `VITE_API_URL` in the build environment to the backend's
public HTTPS API URL, including `/api`, before building and deploying. The
production build intentionally fails when this value is missing, invalid, or
points to localhost. Add the exact Mini App origin to the backend's
`CORS_ORIGIN` allowlist.

The booking history is private to the signed-in customer account. Customers
must sign in before viewing their bookings; looking up history by phone number
is not supported.

### Using Zalo Mini App Extension

1. Install [Visual Studio Code](https://code.visualstudio.com/download) and [Zalo Mini App Extension](https://mini.zalo.me/docs/dev-tools).
1. In the **Home** tab, process **Config App ID** and **Install Dependencies**.
1. Navigate to the **Run** tab, select the suitable launcher, and click **Start**.

### Using Zalo Mini App CLI

1. [Install Node JS](https://nodejs.org/en/download/).
1. [Install Zalo Mini App CLI](https://mini.zalo.me/docs/dev-tools/cli/intro/).
1. **Install dependencies**:
   ```bash
   npm install
   ```
1. **Start** the dev server:
   ```bash
   zmp start
   ```
1. **Open** `localhost:3000` in your browser.

## Deployment

1. **Create** a mini program. For instructions on how to create a mini program, please refer to the [Coffee Shop Tutorial](https://mini.zalo.me/tutorial/coffee-shop/step-1/)

1. **Deploy** your mini program to Zalo using the mini app ID created.

   - **Using Zalo Mini App Extension**: navigate to the **Deploy** panel > **Login** > **Deploy**.
   - **Using Zalo Mini App CLI**:
     ```bash
     zmp login
     zmp deploy
     ```

1. Open the mini app in Zalo by scanning the QR code.

## Resources

- [Zalo Mini App Official Website](https://mini.zalo.me/)
- [ZaUI Documentation](https://mini.zalo.me/documents/zaui/)
- [ZMP SDK Documentation](https://mini.zalo.me/documents/api/)
- [DevTools Documentation](https://mini.zalo.me/docs/dev-tools/)
- [Ready-made Mini App Templates](https://mini.zalo.me/zaui-templates)
- [Community Support](https://mini.zalo.me/community)
