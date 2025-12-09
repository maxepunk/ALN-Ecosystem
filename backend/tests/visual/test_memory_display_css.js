#!/usr/bin/env node
/**
 * Visual verification of PR #3 CSS fixes for memory display.
 *
 * Tests:
 * 1. Status message fade animation (4s duration)
 * 2. Continue hint appears after status fades (~3s delay)
 * 3. Tap-to-continue dismisses memory display
 *
 * Run with orchestrator already running:
 *   node tests/visual/test_memory_display_css.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = '/tmp/aln-visual-test';

async function testMemoryDisplayCSS() {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    console.log('=== Memory Display CSS Visual Test ===\n');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        viewport: { width: 375, height: 812 }  // iPhone X viewport
    });
    const page = await context.newPage();

    try {
        // Navigate to player scanner
        console.log('1. Navigating to player scanner...');
        await page.goto('https://localhost:3000/player-scanner/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);

        await page.screenshot({ path: `${OUTPUT_DIR}/01_initial_state.png` });
        console.log(`   Screenshot: ${OUTPUT_DIR}/01_initial_state.png`);

        // Trigger a scan to show memory display
        console.log('\n2. Triggering token scan to show memory display...');

        const result = await page.evaluate(() => {
            if (window.app && window.app.handleScan) {
                window.app.handleScan('sof002');
                return { success: true };
            }
            return { success: false, error: 'handleScan not available' };
        });

        if (!result.success) {
            console.log(`   ERROR: ${result.error || 'Unknown error'}`);
            await browser.close();
            return false;
        }

        console.log('   Scan triggered successfully');

        // Wait for memory display to appear
        await page.waitForTimeout(500);

        // Screenshot immediately after scan (status should be visible)
        await page.screenshot({ path: `${OUTPUT_DIR}/02_memory_display_t0.png` });
        console.log(`\n3. Memory display at t=0s: ${OUTPUT_DIR}/02_memory_display_t0.png`);

        // Check status overlay visibility at t=0
        const statusVisible = await page.evaluate(() => {
            const status = document.querySelector('.memory-status-overlay');
            if (!status) return { visible: false, error: 'Status overlay not found' };
            const style = getComputedStyle(status);
            return {
                visible: style.opacity !== '0' && style.display !== 'none',
                opacity: style.opacity,
                display: style.display
            };
        });
        console.log(`   Status overlay at t=0: opacity=${statusVisible.opacity || 'N/A'}`);

        // Wait 2 seconds and check (should still be visible - status-fade is 4s)
        console.log('\n4. Waiting 2 seconds (status should still be visible)...');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${OUTPUT_DIR}/03_memory_display_t2.png` });
        console.log(`   Screenshot at t=2s: ${OUTPUT_DIR}/03_memory_display_t2.png`);

        const statusAt2s = await page.evaluate(() => {
            const status = document.querySelector('.memory-status-overlay');
            if (!status) return { opacity: 0 };
            const style = getComputedStyle(status);
            return { opacity: parseFloat(style.opacity) };
        });
        const opacity2s = statusAt2s.opacity || 0;
        console.log(`   Status overlay opacity at t=2s: ${opacity2s}`);

        // Plan says: "status-fade 4s ease-out forwards" with 50% keyframe at 1.0 opacity
        // So at 2s (50% through animation), opacity should still be ~1.0
        if (opacity2s > 0.5) {
            console.log('   ✓ Status overlay still visible at 2s (expected - 50% through 4s animation)');
        } else {
            console.log('   ✗ Status overlay fading too early!');
        }

        // Wait to t=3.5s (continue hint should start appearing - delay is 3s)
        console.log('\n5. Waiting to t=3.5s (continue hint animation should start)...');
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${OUTPUT_DIR}/04_memory_display_t3_5.png` });
        console.log(`   Screenshot at t=3.5s: ${OUTPUT_DIR}/04_memory_display_t3_5.png`);

        const hintAt3_5s = await page.evaluate(() => {
            const hint = document.querySelector('.continue-hint');
            if (!hint) return { found: false };
            const style = getComputedStyle(hint);
            return {
                found: true,
                opacity: parseFloat(style.opacity),
                animationName: style.animationName,
                animationDelay: style.animationDelay
            };
        });
        console.log(`   Continue hint found: ${hintAt3_5s.found || false}`);
        console.log(`   Continue hint opacity: ${hintAt3_5s.opacity || 'N/A'}`);
        console.log(`   Continue hint animation delay: ${hintAt3_5s.animationDelay || 'N/A'}`);

        // Wait to t=5s (status should be mostly faded, hint should be animating)
        console.log('\n6. Waiting to t=5s (status faded, hint breathing)...');
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${OUTPUT_DIR}/05_memory_display_t5.png` });
        console.log(`   Screenshot at t=5s: ${OUTPUT_DIR}/05_memory_display_t5.png`);

        const statusAt5s = await page.evaluate(() => {
            const status = document.querySelector('.memory-status-overlay');
            if (!status) return { opacity: 0 };
            return { opacity: parseFloat(getComputedStyle(status).opacity) };
        });
        console.log(`   Status overlay opacity at t=5s: ${statusAt5s.opacity || 0}`);

        // After 4s animation, status should be fully faded (opacity 0)
        // Use explicit check since default 0 is falsy
        const opacity5s = statusAt5s.opacity;
        if (opacity5s !== undefined && opacity5s < 0.3) {
            console.log('   ✓ Status overlay faded after 4s animation (expected)');
        } else {
            console.log('   ✗ Status overlay not fading properly!');
        }

        // Test tap-to-continue functionality (tests audio onended cleanup indirectly)
        console.log('\n7. Testing tap-to-continue...');

        // Click to continue (use tap target or memory display)
        const tapTarget = await page.$('.memory-tap-target');
        if (tapTarget) {
            await tapTarget.click();
        } else {
            await page.click('#memoryDisplay');
        }
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${OUTPUT_DIR}/06_after_continue.png` });
        console.log(`   Screenshot after continue: ${OUTPUT_DIR}/06_after_continue.png`);

        // Check we're back to scanner view
        const scannerVisible = await page.evaluate(() => {
            const scanner = document.querySelector('.scanner-container');
            const memDisplay = document.querySelector('.memory-display');
            return {
                scannerVisible: scanner && getComputedStyle(scanner).display !== 'none',
                memoryDisplayActive: memDisplay && memDisplay.classList.contains('active')
            };
        });
        console.log(`   Scanner visible: ${scannerVisible.scannerVisible || false}`);
        console.log(`   Memory display active: ${scannerVisible.memoryDisplayActive}`);

        if (!scannerVisible.memoryDisplayActive) {
            console.log('   ✓ Memory display dismissed correctly');
        } else {
            console.log('   ✗ Memory display not dismissed!');
        }

        // Summary
        console.log('\n=== VISUAL TEST SUMMARY ===');
        console.log(`Screenshots saved to: ${OUTPUT_DIR}/`);
        console.log('Review screenshots to verify:');
        console.log('  - 02_memory_display_t0.png: Status message visible');
        console.log('  - 03_memory_display_t2.png: Status still visible (50% of 4s)');
        console.log('  - 04_memory_display_t3_5.png: Continue hint starting to appear');
        console.log('  - 05_memory_display_t5.png: Status faded, hint visible');
        console.log('  - 06_after_continue.png: Back to scanner view');

        await browser.close();
        return true;

    } catch (error) {
        console.error('Test error:', error);
        await browser.close();
        return false;
    }
}

testMemoryDisplayCSS()
    .then(success => process.exit(success ? 0 : 1))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
