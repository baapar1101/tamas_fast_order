import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
const input=fileURLToPath(new URL('../assets/icon.svg',import.meta.url));
const output=fileURLToPath(new URL('../assets/icon.png',import.meta.url));
await sharp(input).png().toFile(output);
