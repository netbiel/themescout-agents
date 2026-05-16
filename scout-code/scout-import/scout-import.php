<?php
/**
 * Plugin Name: Scout Import
 * Description: Import profiles (JSON/TSV), taxonomies, galleries and demo data for ThemeScout theme profiles. Provides Verify Dashboard and REST API for pipeline imports.
 * Version: 1.0.0
 * Author: ThemeScout
 * License: GPL v2 or later
 * Text Domain: scout-import
 * Requires PHP: 7.4
 * Requires at least: 5.8
 *
 * @package ScoutImport
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SCOUT_IMPORT_VERSION', '1.0.0' );
define( 'SCOUT_IMPORT_FILE', __FILE__ );
define( 'SCOUT_IMPORT_PATH', plugin_dir_path( __FILE__ ) );
define( 'SCOUT_IMPORT_URL', plugin_dir_url( __FILE__ ) );

require_once SCOUT_IMPORT_PATH . 'includes/class-importer.php';
require_once SCOUT_IMPORT_PATH . 'includes/class-dashboard.php';
require_once SCOUT_IMPORT_PATH . 'includes/class-rest-api.php';
require_once SCOUT_IMPORT_PATH . 'includes/profile-import.php';

/**
 * Initialize Scout Import plugin.
 */
function scout_import_init(): void {
	if ( is_admin() ) {
		new \ScoutImport\Dashboard();
	}

	// REST API available outside admin for pipeline calls.
	new \ScoutImport\Rest_API();
}
add_action( 'plugins_loaded', 'scout_import_init', 5 );