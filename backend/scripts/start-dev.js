#!/usr/bin/env node
/**
 * Interactive development mode selector for ALN Orchestrator
 * Helps developers choose the right configuration for their needs
 */

const { exec, spawn } = require('child_process');
const readline = require('readline');
const path = require('path');

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
    red: '\x1b[31m'
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log(`
${colors.blue}${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}
${colors.blue}${colors.bright}🚀 ALN Orchestrator Development Mode${colors.reset}
${colors.blue}${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}

Select your development configuration:

  ${colors.green}1)${colors.reset} ${colors.bright}Full System${colors.reset} (Orchestrator + VLC with video)
     Best for: Testing complete functionality
     Starts: VLC GUI + Orchestrator with hot reload

  ${colors.green}2)${colors.reset} ${colors.bright}Orchestrator Only${colors.reset} (no video playback)
     Best for: API development, scanner integration
     Starts: Just the orchestrator, VLC disabled

  ${colors.green}3)${colors.reset} ${colors.bright}PM2 Managed${colors.reset} (production-like)
     Best for: Testing production configuration
     Starts: Both processes via PM2

  ${colors.green}4)${colors.reset} ${colors.bright}Headless Mode${colors.reset} (CI/testing)
     Best for: Automated testing, CI environments
     Starts: VLC without GUI + Orchestrator

  ${colors.yellow}h)${colors.reset} Health Check
  ${colors.yellow}q)${colors.reset} Quit

`);

function runCommand(command, description) {
    console.log(`\n${colors.green}▶${colors.reset} ${description}\n`);
    console.log(`${colors.bright}Command:${colors.reset} ${command}\n`);

    // Close readline interface
    rl.close();

    // Execute command and pipe output
    const child = spawn(command, [], {
        shell: true,
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
    });

    // Handle exit
    child.on('exit', (code) => {
        if (code !== 0) {
            console.log(`\n${colors.red}Process exited with code ${code}${colors.reset}`);
        }
        process.exit(code);
    });
}

function checkHealth() {
    exec('./scripts/check-health.sh', (error, stdout) => {
        console.log(stdout);
        askQuestion();
    });
}

function askQuestion() {
    rl.question(`${colors.bright}Choice [1]:${colors.reset} `, (answer) => {
        const choice = answer.toLowerCase() || '1';

        switch(choice) {
            case '1':
                console.log(`\n${colors.blue}Starting full system with video output...${colors.reset}`);
                runCommand(
                    'npx concurrently -n "VLC,ORCH" -c "blue,green" ' +
                    '"./scripts/vlc-gui.sh" ' +
                    '"nodemon src/server.js"',
                    'Full Development System'
                );
                break;

            case '2':
                console.log(`\n${colors.blue}Starting orchestrator only (no video)...${colors.reset}`);
                runCommand(
                    'FEATURE_VIDEO_PLAYBACK=false nodemon src/server.js',
                    'Orchestrator Only Mode'
                );
                break;

            case '3':
                console.log(`\n${colors.blue}Starting with PM2 management...${colors.reset}`);
                runCommand(
                    'pm2 start ecosystem.config.js && pm2 logs',
                    'PM2 Managed Mode'
                );
                break;

            case '4':
                console.log(`\n${colors.blue}Starting headless mode (no GUI)...${colors.reset}`);
                runCommand(
                    'npx concurrently -n "VLC,ORCH" -c "blue,green" ' +
                    '"./scripts/vlc-headless.sh" ' +
                    '"nodemon src/server.js"',
                    'Headless Development Mode'
                );
                break;

            case 'h':
                checkHealth();
                break;

            case 'q':
                console.log(`\n${colors.yellow}Goodbye!${colors.reset}\n`);
                rl.close();
                process.exit(0);
                break;

            default:
                console.log(`\n${colors.red}Invalid choice. Please try again.${colors.reset}\n`);
                askQuestion();
        }
    });
}

// Start interactive prompt
askQuestion();