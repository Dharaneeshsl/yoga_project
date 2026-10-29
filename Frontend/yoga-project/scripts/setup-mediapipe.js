import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const wasmSourceDir = path.join(projectRoot, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const wasmTargetDir = path.join(projectRoot, 'public', 'wasm');
const modelsTargetDir = path.join(projectRoot, 'public', 'models');
const modelFile = path.join(modelsTargetDir, 'pose_landmarker_lite.task');

const MODEL_REMOTE_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

console.log('📦 Setting up local MediaPipe assets...');

// 1. Copy WASM binaries from node_modules if present
try {
  if (fs.existsSync(wasmSourceDir)) {
    if (!fs.existsSync(wasmTargetDir)) {
      fs.mkdirSync(wasmTargetDir, { recursive: true });
    }
    const files = fs.readdirSync(wasmSourceDir);
    for (const file of files) {
      const src = path.join(wasmSourceDir, file);
      const dest = path.join(wasmTargetDir, file);
      fs.copyFileSync(src, dest);
    }
    console.log(`✅ Copied ${files.length} MediaPipe WASM assets to public/wasm/`);
  } else {
    console.warn('⚠️ tasks-vision wasm source directory not found. Skipping local WASM copy.');
  }
} catch (err) {
  console.warn('⚠️ Could not copy WASM files:', err.message);
}

// 2. Ensure models directory exists and attempt offline model download with timeout guard
async function setupModel() {
  try {
    if (!fs.existsSync(modelsTargetDir)) {
      fs.mkdirSync(modelsTargetDir, { recursive: true });
    }

    if (fs.existsSync(modelFile) && fs.statSync(modelFile).size > 1000) {
      console.log('✅ Local pose_landmarker_lite.task model file already verified.');
      return;
    }

    console.log('⬇️ Attempting to download pose_landmarker_lite.task for local offline use...');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(MODEL_REMOTE_URL, { signal: controller.signal });
    clearTimeout(timeout);

    if (response.ok) {
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(modelFile, buffer);
      console.log(`✅ Successfully downloaded and cached pose_landmarker_lite.task (${Math.round(buffer.length / 1024)} KB)`);
    } else {
      console.warn(`ℹ️ Remote model returned HTTP ${response.status}. Browser CDN fallback will be used.`);
    }
  } catch (err) {
    console.warn(`ℹ️ Model download not completed (${err.name === 'AbortError' ? 'timed out' : err.message}). Browser will seamlessly use the CDN fallback.`);
  }
}

await setupModel();
console.log('✨ MediaPipe setup complete.');
