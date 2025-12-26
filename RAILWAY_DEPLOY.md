# Railway Deployment Guide

This guide explains how to deploy the Zelar IA application to [Railway](https://railway.app/).

## Prerequisites

- A Railway account.
- This repository pushed to your GitHub.

## Deployment Steps

1.  **New Project**:
    - Go to your Railway Dashboard.
    - Click **New Project** > **Deploy from GitHub repo**.
    - Select this repository.

2.  **Configuration**:
    - Railway will automatically detect the `nixpacks.toml` file in the root directory.
    - It should automatically identify the build and start commands defined in `nixpacks.toml`.

3.  **Environment Variables**:
    - Go to the **Variables** tab in your Railway project view.
    - Click **Raw Editor** (usually clearer for bulk add).
    - Copy the contents of your local `.env` file (excluding commented lines or local-only vars if any) and paste them there.
    - **IMPORTANT**: Ensure the following variables are set correctly for production:
        - `DATABASE_URL`: Your production database URL (Railway can provision a Postgres DB for you if needed).
        - `NODE_ENV`: Set to `production`.
        - `PORT`: Railway sets this automatically, but your app should respect `process.env.PORT`.

4.  **Database (PostgreSQL)**:
    - If you need a database, right-click the empty canvas in Railway or click "New" > "Database" > "PostgreSQL".
    - Connect your app to this database by setting the `DATABASE_URL` variable in your app service to the connection string provided by the PostgreSQL service.

5.  **Deploy**:
    - Once variables are saved, Railway usually triggers a deployment automatically.
    - You can view logs in the **Deployments** tab to monitor the build and start process.

## Troubleshooting

- **Puppeteer Issues**: The `nixpacks.toml` is configured to install `chromium` and `ffmpeg`. If you see errors related to Chrome/Chromium, check the build logs to ensure the setup phase installed these packages.
- **Database Connection**: Ensure your IP is not blocked if using an external DB, or that the internal networking is correct if using Railway's DB.
