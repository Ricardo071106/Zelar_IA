# Render Deployment Guide

This guide explains how to deploy the Zelar IA application to [Render](https://render.com/).

## Prerequisites

- A Render account.
- This repository pushed to your GitHub.

## Deployment Steps

1.  **New Web Service**:
    - Go to your Render Dashboard.
    - Click **New +** > **Web Service**.
    - Connect your GitHub repository (`Zelar_IA`).

2.  **Configuration**:
    - Render should automatically detect the `render.yaml` file (Blueprint) if you select "New Blueprint Instance" or simply configure it manually.
    - **Runtime**: Select **Docker**.
    - **Region**: Choose the one closest to you (e.g., Oregon, Frankfurt).
    - **Branch**: `main`.

3.  **Environment Variables**:
    - If not using the Blueprint/render.yaml auto-setup, ensure you add the Environment Variables from your local `.env` file.
    - **Critical Variables for Puppeteer**:
        - `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD`: `true`
        - `PUPPETEER_EXECUTABLE_PATH`: `/usr/bin/google-chrome-stable`
    - **Other Variables**:
        - `DATABASE_URL`: Your production database connection string.
        - `NODE_ENV`: `production`

4.  **Database**:
    - Render provides managed PostgreSQL. You can create one and link it, or use an external provider (like Neon, Supabase, or Railway).

5.  **Deploy**:
    - Click **Create Web Service**.
    - Monitor the build logs. The Dockerfile will install Chrome dependencies automatically.

## Notes

- This setup uses a **Docker** environment to ensure all system dependencies for Puppeteer (Chrome) are present.
- The `Dockerfile` installs `google-chrome-stable` and fonts, so the bot can generate QR codes and render pages correctly.
