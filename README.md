# Digitizer

A web app for solving digit combination puzzles.

<small>_Copyright 2023 Bennett McElwee. All rights reserved._</small>

## Develop & run locally

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Build & release

The app runs entirely in the browser so is released as a static set of files. To create a release:

```bash
npm run release
```

This creates a file `digitizer.zip` which can be unzipped in the root directory of a server and accessed at `/digitizer`.

## Boring details

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).
