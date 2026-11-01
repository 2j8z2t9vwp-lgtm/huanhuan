import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractFrames } from '../vendor/integrations/viralvision-mcp/dist/utils/frames.js';

const [source, output, durationText] = process.argv.slice(2);
const destination = resolve(output);
const duration = Number(durationText);
if (!(duration > 0 && duration <= 600)) throw new Error('Expected a video under 10 minutes');
await mkdir(destination, { recursive: true });
// Adapt the upstream sampler to span the whole clip instead of truncating at 48 frames.
const fps = Math.min(2, 47 / duration);
const selected = await extractFrames(resolve(source), join(destination, 'frames'), {fps, maxFrames: 48, resolution: 720, format: 'jpeg'});
const frames = selected.map((frame, i) => ({
  file: `frames/frame_${String(i + 1).padStart(5, '0')}.jpg`,
  timestamp_sec: Number((i / fps).toFixed(4)),
  timestamp: `约 ${(i / fps).toFixed(1)}s`,
  selection_reason: 'uniform-estimated',
  timestamp_precision: 'estimated',
}));
await writeFile(join(destination, 'frames.json'), JSON.stringify({engine: 'yourhousemktg-ctrl/viralvision-mcp', frames}, null, 2));
console.log(JSON.stringify({frame_count: frames.length}));
