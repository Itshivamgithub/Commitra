const { spawn } = require('child_process');
const path = require('path');

// Ultra-low memory limits for 512MB shared instance
const API_MEMORY = 180;
const WEB_MEMORY = 180;

console.log('🚀 Starting Commitra in ultra-low memory mode...');

function startProcess(name, command, args, cwd, env = {}) {
  const proc = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    shell: true
  });

  proc.stdout.on('data', (data) => {
    console.log(`[${name}] ${data.toString().trim()}`);
  });

  proc.stderr.on('data', (data) => {
    console.error(`[${name}] ERROR: ${data.toString().trim()}`);
  });

  proc.on('close', (code) => {
    console.log(`[${name}] process exited with code ${code}`);
    if (code !== 0) {
      process.exit(code);
    }
  });

  return proc;
}

// 1. Start API
// Use the built dist/app.js
startProcess(
  'API',
  'node',
  [`--max-old-space-size=${API_MEMORY}`, 'apps/api/dist/app.js'],
  process.cwd(),
  { NODE_ENV: 'production', PORT: '3001' }
);

// 2. Start Web (Next.js Standalone)
// In monorepos, standalone output is usually at apps/web/.next/standalone/apps/web/server.js
// but it also creates a server.js at the root of the standalone folder.
const standaloneDir = path.join(process.cwd(), 'apps/web/.next/standalone');
const standaloneServer = path.join(standaloneDir, 'apps/web/server.js');
const rootStandaloneServer = path.join(standaloneDir, 'server.js');

setTimeout(() => {
  console.log('🌐 Starting Web Service...');
  const serverPath = require('fs').existsSync(standaloneServer) ? standaloneServer : rootStandaloneServer;
  
  startProcess(
    'WEB',
    'node',
    [`--max-old-space-size=${WEB_MEMORY}`, serverPath],
    standaloneDir, // Run from inside standalone dir so it finds node_modules
    { 
      NODE_ENV: 'production', 
      PORT: '3000',
    }
  );
}, 2000); // Give API a head start

console.log('📡 Services initiated. API on 3001, Web on 3000.');
console.log('💡 Note: Ensure Render is configured to point to Port 3000 for the Web UI.');
