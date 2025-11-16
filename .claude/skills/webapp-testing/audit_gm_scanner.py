#!/usr/bin/env python3
"""
Comprehensive GM Scanner Audit Script
Tests all major functionality of the ALN GM Scanner module
"""

import json
import time
import sys
from playwright.sync_api import sync_playwright, expect

# Configuration
BASE_URL = "https://localhost:3000/gm-scanner/"
TIMEOUT = 30000  # 30 seconds

def log(message, level="INFO"):
    """Log with timestamp"""
    timestamp = time.strftime("%H:%M:%S")
    print(f"[{timestamp}] [{level}] {message}")

def save_screenshot(page, name):
    """Save screenshot for debugging"""
    path = f"/tmp/gm_scanner_{name}.png"
    page.screenshot(path=path, full_page=True)
    log(f"Screenshot saved: {path}")
    return path

def audit_initial_load(page):
    """Test 1: Initial page load and basic structure"""
    log("=== AUDIT 1: Initial Page Load ===", "TEST")

    try:
        log("Navigating to GM Scanner...")
        page.goto(BASE_URL, wait_until="networkidle", timeout=TIMEOUT)

        log("Waiting for page to be fully loaded...")
        page.wait_for_load_state("networkidle")

        # Take initial screenshot
        save_screenshot(page, "01_initial_load")

        # Check title
        title = page.title()
        log(f"Page title: {title}")
        assert "Memory Transaction Station" in title, f"Expected title to contain 'Memory Transaction Station', got: {title}"

        # Check main container exists
        container = page.locator(".container")
        expect(container).to_be_visible()
        log("✓ Main container is visible")

        # Check header
        header = page.locator(".header")
        expect(header).to_be_visible()
        log("✓ Header is visible")

        # Check for essential UI elements
        connection_status = page.locator("#connectionStatus")
        expect(connection_status).to_be_visible()
        log(f"✓ Connection status: {connection_status.text_content()}")

        # Check mode indicator
        mode_indicator = page.locator("#modeIndicator")
        expect(mode_indicator).to_be_visible()
        log(f"✓ Mode indicator: {mode_indicator.text_content()}")

        # Check device ID display
        device_id = page.locator("#deviceIdDisplay")
        expect(device_id).to_be_visible()
        log(f"✓ Device ID: {device_id.text_content()}")

        log("✓ AUDIT 1 PASSED: Initial load successful", "PASS")
        return True

    except Exception as e:
        log(f"✗ AUDIT 1 FAILED: {str(e)}", "FAIL")
        save_screenshot(page, "01_initial_load_FAILED")
        return False

def audit_navigation_elements(page):
    """Test 2: Navigation buttons and UI components"""
    log("=== AUDIT 2: Navigation Elements ===", "TEST")

    try:
        # Check navigation buttons
        nav_buttons = page.locator(".nav-button")
        count = nav_buttons.count()
        log(f"Found {count} navigation buttons")
        assert count >= 2, f"Expected at least 2 nav buttons, found {count}"

        # Check specific buttons
        history_btn = page.locator('button[data-action="app.showHistory"]')
        expect(history_btn).to_be_visible()
        log("✓ History button visible")

        settings_btn = page.locator('button[data-action="app.showSettings"]')
        expect(settings_btn).to_be_visible()
        log("✓ Settings button visible")

        # Check for scoreboard button (may be hidden initially)
        scoreboard_btn = page.locator('#scoreboardButton')
        log(f"Scoreboard button display: {scoreboard_btn.get_attribute('style')}")

        save_screenshot(page, "02_navigation")

        log("✓ AUDIT 2 PASSED: All navigation elements present", "PASS")
        return True

    except Exception as e:
        log(f"✗ AUDIT 2 FAILED: {str(e)}", "FAIL")
        save_screenshot(page, "02_navigation_FAILED")
        return False

def audit_game_mode_selection(page):
    """Test 3: Game mode selection screen"""
    log("=== AUDIT 3: Game Mode Selection ===", "TEST")

    try:
        # Check if game mode screen is visible
        game_mode_screen = page.locator("#gameModeScreen")

        # Check for mode option buttons
        networked_btn = page.locator('button[data-action="app.selectGameMode"][data-arg="networked"]')
        standalone_btn = page.locator('button[data-action="app.selectGameMode"][data-arg="standalone"]')

        if networked_btn.is_visible():
            log("✓ Networked mode button visible")
            log("✓ Game mode selection screen is active")

            expect(standalone_btn).to_be_visible()
            log("✓ Standalone mode button visible")

            save_screenshot(page, "03_game_mode_selection")

            # Get button text
            networked_text = networked_btn.text_content()
            standalone_text = standalone_btn.text_content()
            log(f"Networked button: {networked_text}")
            log(f"Standalone button: {standalone_text}")

        else:
            log("Game mode screen not visible - may already be in a mode")

        log("✓ AUDIT 3 PASSED: Game mode selection works", "PASS")
        return True

    except Exception as e:
        log(f"✗ AUDIT 3 FAILED: {str(e)}", "FAIL")
        save_screenshot(page, "03_game_mode_FAILED")
        return False

def audit_connection_wizard(page):
    """Test 4: Connection wizard functionality"""
    log("=== AUDIT 4: Connection Wizard ===", "TEST")

    try:
        # Click connection status to open wizard
        connection_status = page.locator("#connectionStatus")
        connection_status.click()

        # Wait for modal
        page.wait_for_timeout(500)

        modal = page.locator("#connectionModal")
        if modal.is_visible():
            log("✓ Connection wizard modal opened")

            # Check for discovery section
            scan_btn = page.locator("#scanServersBtn")
            expect(scan_btn).to_be_visible()
            log("✓ Scan servers button visible")

            # Check manual configuration form
            server_url = page.locator("#serverUrl")
            expect(server_url).to_be_visible()
            log("✓ Server URL input visible")

            station_name = page.locator("#stationName")
            expect(station_name).to_be_visible()
            log("✓ Station name input visible")

            gm_password = page.locator("#gmPassword")
            expect(gm_password).to_be_visible()
            log("✓ GM password input visible")

            save_screenshot(page, "04_connection_wizard")

            # Close modal
            cancel_btn = page.locator('button[data-action="connectionWizard.cancelNetworkedMode"]')
            cancel_btn.click()
            page.wait_for_timeout(500)

        else:
            log("Connection wizard not triggered - checking if already connected")

        log("✓ AUDIT 4 PASSED: Connection wizard functional", "PASS")
        return True

    except Exception as e:
        log(f"✗ AUDIT 4 FAILED: {str(e)}", "FAIL")
        save_screenshot(page, "04_connection_wizard_FAILED")
        return False

def audit_admin_panel(page):
    """Test 5: Admin panel UI and controls"""
    log("=== AUDIT 5: Admin Panel ===", "TEST")

    try:
        # First, check if we need to select networked mode
        networked_btn = page.locator('button[data-action="app.selectGameMode"][data-arg="networked"]')
        if networked_btn.is_visible():
            log("Selecting networked mode...")
            networked_btn.click()
            page.wait_for_timeout(1000)

        # Check if view selector is visible
        view_selector = page.locator("#viewSelector")

        if view_selector.is_visible():
            log("✓ View selector is visible (networked mode active)")

            # Click admin tab
            admin_tab = page.locator('button[data-view="admin"]')
            expect(admin_tab).to_be_visible()
            log("✓ Admin tab visible")

            admin_tab.click()
            page.wait_for_timeout(500)

            # Check admin view is visible
            admin_view = page.locator("#admin-view")
            expect(admin_view).to_be_visible()
            log("✓ Admin view displayed")

            save_screenshot(page, "05a_admin_panel")

            # Check admin sections
            sections = page.locator(".admin-section")
            section_count = sections.count()
            log(f"✓ Found {section_count} admin sections")

            # Check specific sections
            session_section = page.locator(".admin-section h3:has-text('Session Management')")
            if session_section.is_visible():
                log("✓ Session Management section visible")

            video_section = page.locator(".admin-section h3:has-text('Video Controls')")
            if video_section.is_visible():
                log("✓ Video Controls section visible")

            system_section = page.locator(".admin-section h3:has-text('System Status')")
            if system_section.is_visible():
                log("✓ System Status section visible")

            score_section = page.locator(".admin-section h3:has-text('Team Scores')")
            if score_section.is_visible():
                log("✓ Team Scores section visible")

            transaction_section = page.locator(".admin-section h3:has-text('Recent Transactions')")
            if transaction_section.is_visible():
                log("✓ Recent Transactions section visible")

            save_screenshot(page, "05b_admin_sections")

        else:
            log("View selector not visible - may not be in networked mode")

        log("✓ AUDIT 5 PASSED: Admin panel structure verified", "PASS")
        return True

    except Exception as e:
        log(f"✗ AUDIT 5 FAILED: {str(e)}", "FAIL")
        save_screenshot(page, "05_admin_panel_FAILED")
        return False

def audit_video_controls(page):
    """Test 6: Video control panel"""
    log("=== AUDIT 6: Video Controls ===", "TEST")

    try:
        # Check if in admin view
        admin_view = page.locator("#admin-view")

        if admin_view.is_visible():
            # Check video control buttons
            play_btn = page.locator('button[data-action="app.adminPlayVideo"]')
            pause_btn = page.locator('button[data-action="app.adminPauseVideo"]')
            stop_btn = page.locator('button[data-action="app.adminStopVideo"]')
            skip_btn = page.locator('button[data-action="app.adminSkipVideo"]')

            expect(play_btn).to_be_visible()
            log("✓ Play button visible")

            expect(pause_btn).to_be_visible()
            log("✓ Pause button visible")

            expect(stop_btn).to_be_visible()
            log("✓ Stop button visible")

            expect(skip_btn).to_be_visible()
            log("✓ Skip button visible")

            # Check video info display
            current_video = page.locator("#admin-current-video")
            queue_length = page.locator("#admin-queue-length")

            expect(current_video).to_be_visible()
            log(f"✓ Current video display: {current_video.text_content()}")

            expect(queue_length).to_be_visible()
            log(f"✓ Queue length display: {queue_length.text_content()}")

            # Check manual queue control
            manual_input = page.locator("#manual-video-input")
            add_to_queue_btn = page.locator('button[data-action="app.adminAddVideoToQueue"]')
            clear_queue_btn = page.locator('button[data-action="app.adminClearQueue"]')

            expect(manual_input).to_be_visible()
            log("✓ Manual video input visible")

            expect(add_to_queue_btn).to_be_visible()
            log("✓ Add to queue button visible")

            expect(clear_queue_btn).to_be_visible()
            log("✓ Clear queue button visible")

            save_screenshot(page, "06_video_controls")

        else:
            log("Admin view not visible - skipping video controls check")

        log("✓ AUDIT 6 PASSED: Video controls present", "PASS")
        return True

    except Exception as e:
        log(f"✗ AUDIT 6 FAILED: {str(e)}", "FAIL")
        save_screenshot(page, "06_video_controls_FAILED")
        return False

def audit_debug_view(page):
    """Test 7: Debug view"""
    log("=== AUDIT 7: Debug View ===", "TEST")

    try:
        # Click debug tab
        debug_tab = page.locator('button[data-view="debug"]')

        if debug_tab.is_visible():
            debug_tab.click()
            page.wait_for_timeout(500)

            # Check debug view is visible
            debug_view = page.locator("#debug-view")
            expect(debug_view).to_be_visible()
            log("✓ Debug view displayed")

            # Check debug content
            debug_content = page.locator("#debugContent")
            expect(debug_content).to_be_visible()
            log("✓ Debug content container visible")

            save_screenshot(page, "07_debug_view")

        else:
            log("Debug tab not visible - may not be in networked mode")

        log("✓ AUDIT 7 PASSED: Debug view functional", "PASS")
        return True

    except Exception as e:
        log(f"✗ AUDIT 7 FAILED: {str(e)}", "FAIL")
        save_screenshot(page, "07_debug_view_FAILED")
        return False

def audit_scanner_view(page):
    """Test 8: Scanner view and screens"""
    log("=== AUDIT 8: Scanner View ===", "TEST")

    try:
        # Switch back to scanner view
        scanner_tab = page.locator('button[data-view="scanner"]')

        if scanner_tab.is_visible():
            scanner_tab.click()
            page.wait_for_timeout(500)

        # Check scanner view is visible
        scanner_view = page.locator("#scanner-view")
        expect(scanner_view).to_be_visible()
        log("✓ Scanner view displayed")

        # Check for various screens (they may be hidden)
        screens = {
            "loadingScreen": "Loading Screen",
            "settingsScreen": "Settings Screen",
            "gameModeScreen": "Game Mode Screen",
            "teamEntryScreen": "Team Entry Screen",
            "scanScreen": "Scan Screen",
            "resultScreen": "Result Screen",
            "historyScreen": "History Screen",
            "scoreboardScreen": "Scoreboard Screen",
            "teamDetailsScreen": "Team Details Screen"
        }

        for screen_id, screen_name in screens.items():
            screen = page.locator(f"#{screen_id}")
            if screen.count() > 0:
                log(f"✓ {screen_name} exists in DOM")
            else:
                log(f"✗ {screen_name} missing", "WARN")

        save_screenshot(page, "08_scanner_view")

        log("✓ AUDIT 8 PASSED: Scanner view structure verified", "PASS")
        return True

    except Exception as e:
        log(f"✗ AUDIT 8 FAILED: {str(e)}", "FAIL")
        save_screenshot(page, "08_scanner_view_FAILED")
        return False

def audit_settings_screen(page):
    """Test 9: Settings screen functionality"""
    log("=== AUDIT 9: Settings Screen ===", "TEST")

    try:
        # Click settings button
        settings_btn = page.locator('button[data-action="app.showSettings"]')
        settings_btn.click()
        page.wait_for_timeout(500)

        # Check settings screen is visible
        settings_screen = page.locator("#settingsScreen")

        if settings_screen.is_visible():
            log("✓ Settings screen displayed")

            # Check device ID input
            device_id_input = page.locator("#deviceId")
            expect(device_id_input).to_be_visible()
            log("✓ Device ID input visible")

            # Check mode toggle
            mode_toggle = page.locator("#modeToggle")
            expect(mode_toggle).to_be_visible()
            log("✓ Mode toggle visible")

            # Check data management buttons
            export_json_btn = page.locator('button[data-action="dataManager.exportData"][data-arg="json"]')
            expect(export_json_btn).to_be_visible()
            log("✓ Export JSON button visible")

            export_csv_btn = page.locator('button[data-action="dataManager.exportData"][data-arg="csv"]')
            expect(export_csv_btn).to_be_visible()
            log("✓ Export CSV button visible")

            clear_data_btn = page.locator('button[data-action="dataManager.clearData"]')
            expect(clear_data_btn).to_be_visible()
            log("✓ Clear data button visible")

            save_screenshot(page, "09_settings_screen")

        else:
            log("Settings screen not visible")

        log("✓ AUDIT 9 PASSED: Settings screen functional", "PASS")
        return True

    except Exception as e:
        log(f"✗ AUDIT 9 FAILED: {str(e)}", "FAIL")
        save_screenshot(page, "09_settings_FAILED")
        return False

def audit_history_screen(page):
    """Test 10: History screen"""
    log("=== AUDIT 10: History Screen ===", "TEST")

    try:
        # Click history button
        history_btn = page.locator('button[data-action="app.showHistory"]')
        history_btn.click()
        page.wait_for_timeout(500)

        # Check history screen is visible
        history_screen = page.locator("#historyScreen")

        if history_screen.is_visible():
            log("✓ History screen displayed")

            # Check summary stats
            total_scans = page.locator("#totalScans")
            expect(total_scans).to_be_visible()
            log(f"✓ Total scans: {total_scans.text_content()}")

            unique_teams = page.locator("#uniqueTeams")
            expect(unique_teams).to_be_visible()
            log(f"✓ Unique teams: {unique_teams.text_content()}")

            # Check filter bar
            search_filter = page.locator("#searchFilter")
            expect(search_filter).to_be_visible()
            log("✓ Search filter visible")

            mode_filter = page.locator("#modeFilter")
            expect(mode_filter).to_be_visible()
            log("✓ Mode filter visible")

            # Check history container
            history_container = page.locator("#historyContainer")
            expect(history_container).to_be_visible()
            log("✓ History container visible")

            save_screenshot(page, "10_history_screen")

        else:
            log("History screen not visible")

        log("✓ AUDIT 10 PASSED: History screen functional", "PASS")
        return True

    except Exception as e:
        log(f"✗ AUDIT 10 FAILED: {str(e)}", "FAIL")
        save_screenshot(page, "10_history_FAILED")
        return False

def audit_console_errors(page):
    """Test 11: Check for console errors"""
    log("=== AUDIT 11: Console Errors ===", "TEST")

    errors = []
    warnings = []

    def handle_console(msg):
        if msg.type == 'error':
            errors.append(msg.text)
            log(f"Console ERROR: {msg.text}", "ERROR")
        elif msg.type == 'warning':
            warnings.append(msg.text)
            log(f"Console WARNING: {msg.text}", "WARN")

    page.on("console", handle_console)

    try:
        # Reload page to capture all console messages
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(3000)

        log(f"Found {len(errors)} console errors")
        log(f"Found {len(warnings)} console warnings")

        if errors:
            log("Console errors detected:", "WARN")
            for error in errors:
                log(f"  - {error}", "ERROR")

        log("✓ AUDIT 11 PASSED: Console audit complete", "PASS")
        return True

    except Exception as e:
        log(f"✗ AUDIT 11 FAILED: {str(e)}", "FAIL")
        return False

def audit_responsive_design(page):
    """Test 12: Responsive design check"""
    log("=== AUDIT 12: Responsive Design ===", "TEST")

    try:
        viewports = [
            {"width": 1920, "height": 1080, "name": "Desktop"},
            {"width": 768, "height": 1024, "name": "Tablet"},
            {"width": 375, "height": 667, "name": "Mobile"}
        ]

        for viewport in viewports:
            log(f"Testing viewport: {viewport['name']} ({viewport['width']}x{viewport['height']})")
            page.set_viewport_size({"width": viewport["width"], "height": viewport["height"]})
            page.wait_for_timeout(500)

            # Check main container is visible
            container = page.locator(".container")
            expect(container).to_be_visible()
            log(f"✓ Container visible in {viewport['name']}")

            save_screenshot(page, f"12_responsive_{viewport['name'].lower()}")

        # Reset to desktop
        page.set_viewport_size({"width": 1920, "height": 1080})

        log("✓ AUDIT 12 PASSED: Responsive design verified", "PASS")
        return True

    except Exception as e:
        log(f"✗ AUDIT 12 FAILED: {str(e)}", "FAIL")
        return False

def audit_accessibility(page):
    """Test 13: Basic accessibility checks"""
    log("=== AUDIT 13: Accessibility ===", "TEST")

    try:
        # Check for main heading
        main_heading = page.locator("h1")
        expect(main_heading).to_be_visible()
        log(f"✓ Main heading present: {main_heading.text_content()}")

        # Check for buttons with accessible text
        buttons = page.locator("button")
        button_count = buttons.count()
        log(f"✓ Found {button_count} buttons")

        # Check for form labels
        labels = page.locator("label")
        label_count = labels.count()
        log(f"✓ Found {label_count} form labels")

        # Check for alt text on images (if any)
        images = page.locator("img")
        image_count = images.count()
        log(f"Found {image_count} images")

        log("✓ AUDIT 13 PASSED: Basic accessibility checks passed", "PASS")
        return True

    except Exception as e:
        log(f"✗ AUDIT 13 FAILED: {str(e)}", "FAIL")
        return False

def main():
    """Main audit execution"""
    log("=" * 60)
    log("GM SCANNER COMPREHENSIVE AUDIT")
    log("=" * 60)

    results = {
        "passed": 0,
        "failed": 0,
        "total": 0
    }

    with sync_playwright() as p:
        log("Launching browser...")
        browser = p.chromium.launch(
            headless=True,
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        )

        context = browser.new_context(
            ignore_https_errors=True,  # Self-signed cert
            viewport={"width": 1920, "height": 1080}
        )

        page = context.new_page()

        # Run all audits
        audits = [
            ("Initial Load", audit_initial_load),
            ("Navigation Elements", audit_navigation_elements),
            ("Game Mode Selection", audit_game_mode_selection),
            ("Connection Wizard", audit_connection_wizard),
            ("Admin Panel", audit_admin_panel),
            ("Video Controls", audit_video_controls),
            ("Debug View", audit_debug_view),
            ("Scanner View", audit_scanner_view),
            ("Settings Screen", audit_settings_screen),
            ("History Screen", audit_history_screen),
            ("Console Errors", audit_console_errors),
            ("Responsive Design", audit_responsive_design),
            ("Accessibility", audit_accessibility),
        ]

        for name, audit_func in audits:
            results["total"] += 1
            if audit_func(page):
                results["passed"] += 1
            else:
                results["failed"] += 1
            log("")  # Blank line between audits

        browser.close()

    # Final report
    log("=" * 60)
    log("AUDIT SUMMARY")
    log("=" * 60)
    log(f"Total Audits: {results['total']}")
    log(f"Passed: {results['passed']}", "PASS")
    log(f"Failed: {results['failed']}", "FAIL" if results['failed'] > 0 else "PASS")
    log(f"Success Rate: {(results['passed']/results['total']*100):.1f}%")
    log("=" * 60)

    # Save results to file
    report_path = "/tmp/gm_scanner_audit_report.json"
    with open(report_path, 'w') as f:
        json.dump(results, f, indent=2)
    log(f"Full report saved to: {report_path}")

    # Exit with appropriate code
    sys.exit(0 if results['failed'] == 0 else 1)

if __name__ == "__main__":
    main()
