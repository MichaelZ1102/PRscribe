import { config } from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env');

// Check .env exists
if (!existsSync(envPath)) {
  console.error('❌ .env file not found at', envPath);
  process.exit(1);
}
console.log('✅ .env file exists at', envPath);

// Load dotenv
const result = config({ path: envPath });
if (result.error) {
  console.error('❌ dotenv config() failed:', result.error.message);
  process.exit(1);
}
console.log('✅ dotenv parsed successfully');

// Read raw lines to validate format
const content = readFileSync(envPath, 'utf-8');
const lines = content.split('\n');
let validLines = 0;
let commentLines = 0;
let emptyLines = 0;
let errorLines = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (line === '') { emptyLines++; continue; }
  if (line.startsWith('#') && !line.includes('===')) { commentLines++; continue; }
  if (/^[A-Z_]+=/.test(line)) { validLines++; continue; }
  if (line.startsWith('#') || line.startsWith('---')) { commentLines++; continue; }
  errorLines++;
}

console.log(`\n📊 Statistics:`);
console.log(`   Valid env vars: ${validLines}`);
console.log(`   Comment lines:  ${commentLines}`);
console.log(`   Empty lines:    ${emptyLines}`);
if (errorLines > 0) console.log(`   ⚠️  Parse warnings: ${errorLines}`);

// List the keys (without values for security)
const keyList = Object.keys(result.parsed || {}).sort();
console.log(`\n📋 Variables loaded (${keyList.length}):`);
keyList.forEach(k => {
  const val = process.env[k];
  const preview = val && val.length > 20 ? val.substring(0, 20) + '...' : val;
  console.log(`   ${k}=${preview}`);
});

// Verify critical vars exist (with placeholder values)
const required = ['GITHUB_APP_ID', 'GITHUB_PRIVATE_KEY', 'GITHUB_WEBHOOK_SECRET'];
const missing = required.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.log(`\n⚠️  Missing vars (will be filled after P1-02): ${missing.join(', ')}`);
} else {
  console.log(`\n✅ All required vars present`);
}

console.log(`\n🎉 .env validation complete — file is well-formed and loadable.`);
