# PoseYoga Frontend

This directory contains the core React single-page application for **PoseYoga**, powered by Vite and `@mediapipe/tasks-vision`.

For comprehensive project documentation, architecture overview, and instructions, please refer to the main [README.md](../../README.md) at the repository root.

## Scripts

- `npm run dev`: Starts the Vite local development server with HMR.
- `npm run build`: Compiles and bundles production assets into `dist/`.
- `npm run test`: Executes the Node.js unit test suite for angle math, scoring, and debouncing.
- `npm run lint`: Runs ESLint across all source components and utilities.
- `npm run postinstall`: Runs the MediaPipe asset setup script (`scripts/setup-mediapipe.js`).
