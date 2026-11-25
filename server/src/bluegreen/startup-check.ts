/**
 * Fail-fast env checks for blue-green / production deploys (BUG-34, BUG-48).
 * Returns a list of human-readable problems; main.ts refuses to start if it is not empty.
 */
export function startupProblems(env: NodeJS.ProcessEnv = process.env): string[] {
  const problems: string[] = [];
  const node = (env.NODE_NAME || '').trim().toLowerCase();
  const prod = (env.NODE_ENV || '').trim().toLowerCase() === 'production';
  const blueGreen = node === 'blue' || node === 'green';
  if ((prod || blueGreen) && !(env.APP_VERSION || '').trim()) {
    problems.push(
      `APP_VERSION is required when NODE_ENV=production or NODE_NAME=blue|green ` +
      `(got NODE_ENV=${env.NODE_ENV || ''}, NODE_NAME=${env.NODE_NAME || ''}). ` +
      `Without it clients would see a wrong server version and a permanent update banner. Set APP_VERSION=<release version>, e.g. 0.58.0.`,
    );
  }
  const rawPort = (env.INTERNAL_PORT ?? '').trim().toLowerCase();
  const internalOn = !!rawPort && !['0', 'off', 'none', 'false'].includes(rawPort);
  const host = (env.INTERNAL_HOST || '127.0.0.1').trim() || '127.0.0.1';
  const loopback = host === '127.0.0.1' || host === '::1' || host === 'localhost';
  if (internalOn && !loopback && !(env.INTERNAL_TOKEN || '').trim()) {
    problems.push(
      `INTERNAL_TOKEN is required when INTERNAL_HOST=${host} is not loopback. ` +
      `Set the same INTERNAL_TOKEN on both slots and in deploy.sh.`,
    );
  }
  return problems;
}
