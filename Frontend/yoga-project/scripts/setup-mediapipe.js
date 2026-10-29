import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const wasmSourceDir = path.join(projectRoot, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const wasmTargetDir = path.join(projectRoot, 'public', 'wasm');
const modelsTargetDir = path.join(projectRoot, 'public', 'models');

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

// 2. Ensure models directory exists
try {
  if (!fs.existsSync(modelsTargetDir)) {
    fs.mkdirSync(modelsTargetDir, { recursive: true });
  }
  const modelFile = path.join(modelsTargetDir, 'pose_landmarker_lite.task');
  if (fs.existsSync(modelFile) && fs.statSync(modelFile).size > 1000) {
    console.log('✅ Local pose_landmarker_lite.task model file verified.');
  } else {
    console.log('ℹ️ Local pose_landmarker_lite.task not present. The browser will use the CDN fallback with automatic caching.');
  }
} catch (err) {
  console.warn('⚠️ Models setup note:', err.message);
}

console.log('✨ MediaPipe setup complete.');
