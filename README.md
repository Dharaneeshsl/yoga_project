# PoseYoga 🧘‍♀️

> Intelligent, real-time browser yoga pose guidance and posture analysis powered by on-device MediaPipe AI.

PoseYoga is a modern web application built with React and Vite that provides interactive yoga practice with instant visual and audio posture corrections. All vision processing is executed 100% locally on your device using WebAssembly and WebGL—no webcam video or sensitive data ever leaves your computer.

---

## ✨ Features

- **On-Device Vision AI**: Powered by `@mediapipe/tasks-vision` running WebAssembly locally.
- **Aspect-Corrected Geometry**: Computes precise Euclidean joint angles in screen space, avoiding normalized aspect-ratio distortion.
- **Mirrored Side Detection**: Poses like Tree Pose and Warrior II automatically detect and score whichever leg or arm side you perform.
- **Pre-Flight Full Body Check**: Verifies that your full silhouette (head, shoulders, hips, knees, and ankles) is in view before timing begins, with intelligent feet-rule relaxation for floor poses (Cobra, Downward Dog).
- **Continuous Hold Verification**: Hold timer only advances when you actively maintain the posture above the similarity threshold.
- **Accurate Directional Feedback**: Natural language cues pointing in the correct anatomical direction (e.g., "Bend your front knee deeper", "Raise your left arm higher"), prioritized by relative error (`diff / tolerance`).
- **Zero Flickering Guidance**: Debounced hints require errors to persist before alerting, avoiding single-frame jitter.
- **Voice Guidance**: Real-time spoken countdowns, encouragement, and posture reminders via the Web Speech API.
- **Self-Hosted Vector Illustrations**: High-resolution, offline SVG illustrations for every pose—no external third-party hotlinking or copyright risks.
- **Progressive Curriculum & Persistence**: 5 curated poses with level gating, personal best tracking, and practice history stored locally in `localStorage`.
- **Accessible & Responsive**: High-contrast color tokens, keyboard navigation, visible focus indicators, and mobile-friendly layouts.

---

## 🗂️ Project Structure

```text
yoga-project/
├── .gitignore                      # Root gitignore excluding dependencies and secrets
├── README.md                       # Repository documentation
└── Frontend/
    └── yoga-project/               # Core React application (Vite)
        ├── public/
        │   ├── models/             # MediaPipe task models (cached for offline use)
        │   ├── poses/              # Self-hosted SVG pose illustrations
        │   └── wasm/               # Self-hosted MediaPipe WebAssembly binaries
        ├── scripts/
        │   └── setup-mediapipe.js  # Asset copying and model download postinstall script
        ├── src/
        │   ├── components/         # Clean React UI components
        │   │   ├── FinalScreen.jsx # Session summary, card export & confetti celebration
        │   │   ├── Landing.jsx     # Value proposition & curriculum selector
        │   │   ├── LevelScreen.jsx # Practice canvas, skeleton & real-time checklist
        │   │   ├── ScoreScreen.jsx # Animated score & joint breakdown
        │   │   └── SettingsModal.jsx # Camera, hold time, and difficulty controls
        │   ├── data/
        │   │   └── levels.js       # Target angles, tolerances, tips & benefits
        │   ├── hooks/              # Custom modular lifecycle hooks
        │   │   ├── useCamera.js    # Camera stream lifecycle & permission errors
        │   │   ├── useHoldTimer.js # Continuous hold timer with tab pause
        │   │   ├── usePoseLandmarker.js # MediaPipe pose detection pipeline
        │   │   └── useVoiceGuidance.js  # Web Speech synthesis
        │   ├── utils/
        │   │   ├── poseFeedback.js # Normalized hint prioritization & debounce
        │   │   ├── poseUtils.js    # Mathematical geometry & skeleton rendering
        │   │   ├── poseUtils.test.js # Unit tests for math and feedback logic
        │   │   ├── scoring.test.js # Unit tests for scoring, hold progress & persistence
        │   │   ├── soundEffects.js # Audio chime synthesis via Web Audio API
        │   │   └── storageUtils.js # Safe storage parsers and hold progress math
        │   ├── App.jsx             # Main application state orchestrator
        │   ├── index.css           # Modern design system & accessible styles
        │   └── main.jsx            # React root mount
        ├── .env.example            # Environment configuration template
        ├── eslint.config.js        # Modern ESLint configuration
        ├── package.json            # Scripts and dependencies
        └── vite.config.js          # Vite build configuration
```

---

## 🚀 Quick Start

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (version 20.19+ or 22+ recommended)
- A modern web browser (Chrome, Edge, Brave, Firefox, or Safari) with webcam access
- HTTPS context or `localhost` (required by browser security policies for webcam access)

### 2. Install Dependencies

Navigate into the frontend directory:

```bash
cd Frontend/yoga-project
npm install
```

> **Note**: The `postinstall` script will automatically copy `@mediapipe/tasks-vision` WASM assets to `public/wasm/` and download `pose_landmarker_lite.task` to `public/models/` for offline capability. If internet access is restricted during install, the browser will seamlessly fall back to the pinned jsDelivr CDN version when online.

### 3. Run Development Server

```bash
npm run dev
```

Open your browser to `http://localhost:5173`.

### 4. Build for Production

```bash
npm run build
```

This generates an optimized production bundle inside `Frontend/yoga-project/dist/`.

To test the production build locally:

```bash
npm run preview
```

---

## 🧪 Testing & Code Quality

Run the unit test suite covering 2D angle geometry, visibility checks, hint direction logic, real storage parsers, and continuous hold progression:

```bash
npm run test
```

Run static analysis and linting:

```bash
npm run lint
```

---

## 🛠️ Demo & Calibration Shortcuts

- **Instant Demo Unlock**: Append `?unlock=all` to the URL (e.g., `http://localhost:5173/?unlock=all`) to immediately unlock all 5 curriculum levels for seamless live presentations.
- **Live Calibration HUD**: Append `?debug=1` to any URL or set `VITE_ENABLE_DEBUG=true` in `.env.local` to open an on-screen engineering HUD displaying live joint angles, targets, diffs, tolerances, and a one-click **Copy Angles JSON** button for pose calibration.

---

## 🔒 Privacy & Permissions

- **100% Local Inference**: Video frames are captured directly by your browser and processed in-memory using WebAssembly and WebGL. No image or video stream is ever transmitted over the network or saved to any server.
- **HTTPS Requirement**: Modern browsers require an encrypted context (`https://` or `localhost`) to grant webcam access. When deploying to production (e.g., Vercel, Netlify, Cloudflare Pages), ensure HTTPS is enabled.

---

## ⚠️ Yoga & Safety Guidance

PoseYoga's automated angle matching provides bio-mechanical estimations based on 2D camera projections for fitness and posture awareness. It does not constitute medical advice or guarantee injury-free practice. Always listen to your body, avoid forcing any joint beyond comfortable limits, and consult a certified yoga instructor or medical professional for personalized guidance.

---

## 📄 License

MIT License. Free for personal, educational, and commercial use.
