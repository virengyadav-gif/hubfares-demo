import path from 'node:path';
import { AppError } from '@/shared/errors';
/** Reset/seed safety: mock mode only and an allow-listed local demo/test SQLite path. */
export function assertDemoDbAllowed(file: string) {
  if ((process.env.DEMO_MODE ?? 'mock') !== 'mock') throw new AppError('RESET_NOT_ALLOWED', 'Seed/reset is only permitted when DEMO_MODE=mock');
  const base = path.basename(file);
  const okName = /^hubfares-(demo|test)[\w.-]*\.sqlite$/.test(base);
  if (!okName) throw new AppError('RESET_NOT_ALLOWED', `Database ${base} is not an allow-listed demo/test database`);
}
export function assertResetEnabled() {
  if (process.env.DEMO_RESET_ENABLED === 'false') throw new AppError('RESET_NOT_ALLOWED', 'Demo reset is disabled (DEMO_RESET_ENABLED=false)');
}
