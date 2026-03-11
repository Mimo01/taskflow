import '@testing-library/jest-dom';
import { randomFillSync } from 'crypto';

Object.defineProperty(window, 'crypto', {
  value: { getRandomValues: (buf: BufferSource) => randomFillSync(buf as Buffer) },
  configurable: true,
});
