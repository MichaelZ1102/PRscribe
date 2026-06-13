import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');

export interface GitHubAppAuth {
  appId: string;
  privateKey: string;
}

/**
 * 生成 GitHub App JWT（用于获取 Installation Token）
 */
export function createAppJWT(auth: GitHubAppAuth): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60,
    exp: now + 600,
    iss: auth.appId,
  };

  return jwt.sign(payload, auth.privateKey, { algorithm: 'RS256' });
}

/**
 * 解码 JWT（不验证签名）
 */
export function decodeJWT(token: string): Record<string, unknown> | null {
  try {
    const decoded = jwt.decode(token);
    return decoded as Record<string, unknown>;
  } catch {
    return null;
  }
}
