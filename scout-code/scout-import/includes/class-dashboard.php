<?php
/**
 * Scout Import — Verification Dashboard
 *
 * WP Admin page for reviewing and resolving validation issues
 * on theme-profile posts. Provides theme list view, single-theme
 * verification view, inline editing, and bulk actions.
 *
 * @package ScoutImport
 */

namespace ScoutImport;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Main dashboard class — registers menu, renders UI, handles AJAX.
 */
class Dashboard {

	/**
	 * Menu page hook suffix.
	 *
	 * @var string
	 */
	private $hook_suffix = '';

	/**
	 * Field action map — which ACF fields can be edited inline.
	 *
	 * @return array
	 */
	public static function get_field_action_map(): array {
		return array(
			// === EDYTOWALNE — inline edit + override ===
			'pricing'              => array( 'acf_field' => 'pricing_model', 'type' => 'select', 'options' => array( 'free', 'freemium', 'one_time_purchase', 'annual_subscription', 'lifetime_license' ), 'overridable' => true ),
			'base_price'           => array( 'acf_field' => 'base_price', 'type' => 'number', 'overridable' => true ),
			'last_update'          => array( 'acf_field' => 'last_update', 'type' => 'date', 'overridable' => true ),
			'sales_count'          => array( 'acf_field' => 'sales_count', 'type' => 'text', 'overridable' => true ),
			'distribution'         => array( 'acf_field' => 'distribution_model', 'type' => 'select', 'options' => array( 'themeforest', 'wordpress_org', 'direct_sale' ), 'overridable' => true ),
			'theme_version'        => array( 'acf_field' => 'theme_version', 'type' => 'text', 'overridable' => true ),
			'demo_url'             => array( 'acf_field' => 'demo_url', 'type' => 'url', 'overridable' => true ),
			'min_wp_version'       => array( 'acf_field' => 'min_wp_version', 'type' => 'text', 'overridable' => true ),
			'min_php_version'      => array( 'acf_field' => 'min_php_version', 'type' => 'text', 'overridable' => true ),
			'money_back_guarantee' => array( 'acf_field' => 'money_back_guarantee', 'type' => 'number', 'overridable' => true ),
			// === EDYTOWALNE ZŁOŻONE — custom form ===
			'plugin_compat_list'   => array( 'acf_field' => 'plugin_compatibility_list', 'type' => 'repeater_append', 'subfields' => array( 'plugin', 'plugin_category', 'compatibility_status', 'compatibility_notes', 'user_issues' ), 'overridable' => true ),
			// === READONLY — kalkulowane przez pipeline ===
			'search_profile'       => array( 'acf_field' => 'search_profile', 'type' => 'readonly', 'overridable' => false, 'fix_instruction' => 'Popraw źródłowe pole w pipeline → Assign Taxonomies → Re-run Cleanup' ),
			'handoff_score'        => array( 'acf_field' => 'handoff_score', 'type' => 'readonly', 'overridable' => false, 'fix_instruction' => 'Przeliczany z panel_complexity + docs_quality + learning_curve. Popraw enumy w pipeline.' ),
			'performance_tier'     => array( 'acf_field' => 'performance_tier', 'type' => 'readonly', 'overridable' => false, 'fix_instruction' => 'Przeliczany z pagespeed_mobile. Popraw wynik PageSpeed w scraped JSON.' ),
		);
	}

	/**
	 * Constructor — register hooks.
	 */
	public function __construct() {
		add_action( 'admin_menu', array( $this, 'register_menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );

		// AJAX handlers.
		add_action( 'wp_ajax_wpagent_verify_import', array( $this, 'ajax_import_tsv' ) );
		add_action( 'wp_ajax_wpagent_verify_resolve', array( $this, 'ajax_resolve_issue' ) );
		add_action( 'wp_ajax_wpagent_verify_update_field', array( $this, 'ajax_update_acf_field' ) );
		add_action( 'wp_ajax_wpagent_verify_bulk_resolve', array( $this, 'ajax_bulk_resolve' ) );
		add_action( 'wp_ajax_wpagent_verify_remove_override', array( $this, 'ajax_remove_override' ) );
		add_action( 'wp_ajax_wpagent_verify_remove_all_overrides', array( $this, 'ajax_remove_all_overrides' ) );

		// CPT list columns.
		add_filter( 'manage_theme-profile_posts_columns', array( $this, 'add_cpt_column' ) );
		add_action( 'manage_theme-profile_posts_custom_column', array( $this, 'render_cpt_column' ), 10, 2 );
	}

	// ─── Menu Registration ──────────────────────────────────────────────

	/**
	 * Register the ThemeScout top-level menu and Verify Data submenu.
	 */
	public function register_menu(): void {
		add_menu_page(
			__( 'ThemeScout', 'scout-import' ),
			__( 'ThemeScout', 'scout-import' ),
			'manage_options',
			'themescout-dashboard',
			array( $this, 'render_page' ),
			'dashicons-shield-alt',
			30
		);

		$this->hook_suffix = add_submenu_page(
			'themescout-dashboard',
			__( 'Verify Data', 'scout-import' ),
			__( 'Verify Data', 'scout-import' ),
			'manage_options',
			'themescout-dashboard',
			array( $this, 'render_page' )
		);
	}

	// ─── Asset Enqueue ──────────────────────────────────────────────────

	/**
	 * Enqueue CSS + JS only on our page.
	 *
	 * @param string $hook Current admin page hook.
	 */
	public function enqueue_assets( string $hook ): void {
		if ( 'toplevel_page_themescout-dashboard' !== $hook ) {
			return;
		}

		wp_enqueue_style(
			'scout-import-dashboard',
			SCOUT_IMPORT_URL . 'assets/css/dashboard.css',
			array(),
			SCOUT_IMPORT_VERSION
		);

		wp_enqueue_script(
			'scout-import-dashboard',
			SCOUT_IMPORT_URL . 'assets/js/dashboard.js',
			array( 'jquery' ),
			SCOUT_IMPORT_VERSION,
			true
		);

		wp_localize_script( 'scout-import-dashboard', 'wpVerifyDashboard', array(
			'ajaxUrl'        => admin_url( 'admin-ajax.php' ),
			'nonce'          => wp_create_nonce( 'wpagent_verify' ),
			'fieldActionMap' => self::get_field_action_map(),
		) );
	}

	// ─── Page Router ────────────────────────────────────────────────────

	/**
	 * Render the page — dispatch to list or single view.
	 */
	public function render_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'scout-import' ) );
		}

		echo '<div class="wrap verify-dashboard">';

		if ( ! empty( $_GET['theme_id'] ) ) {
			$this->render_theme_verification( absint( $_GET['theme_id'] ) );
		} else {
			$this->render_themes_list();
		}

		$this->render_import_modal();

		echo '</div>';
	}

	// ─── Themes List View ───────────────────────────────────────────────

	/**
	 * Render the list of themes with validation summaries.
	 */
	private function render_themes_list(): void {
		$themes = $this->get_themes_with_issues();

		echo '<h1 class="wp-heading-inline">' . esc_html__( 'Theme Verification Dashboard', 'scout-import' ) . '</h1>';
		echo '<button type="button" class="page-title-action" id="vd-open-import">' . esc_html__( 'Import Validation Data', 'scout-import' ) . '</button>';
		echo '<hr class="wp-header-end">';

		echo '<div class="vd-filters">';
		echo '<select id="vd-filter-severity"><option value="">' . esc_html__( 'All Severities', 'scout-import' ) . '</option><option value="error">🔴 Errors</option><option value="warning">🟡 Warnings</option><option value="info">🟢 Info</option></select>';
		echo '<select id="vd-filter-status"><option value="">' . esc_html__( 'All Statuses', 'scout-import' ) . '</option><option value="pending">⏳ Pending</option><option value="in_progress">🔄 In Progress</option><option value="done">✅ Done</option></select>';
		echo '<select id="vd-filter-overrides"><option value="">' . esc_html__( 'All Overrides', 'scout-import' ) . '</option><option value="has_overrides">🛡️ Has Overrides</option><option value="no_overrides">No Overrides</option></select>';
		echo '</div>';

		if ( empty( $themes ) ) {
			echo '<div class="notice notice-info"><p>' . esc_html__( 'No validation data imported yet. Click "Import Validation Data" to begin.', 'scout-import' ) . '</p></div>';
			return;
		}

		echo '<table class="wp-list-table widefat fixed striped vd-themes-table">';
		echo '<thead><tr>';
		echo '<th>' . esc_html__( 'Theme', 'scout-import' ) . '</th>';
		echo '<th class="vd-col-id">WP ID</th>';
		echo '<th class="vd-col-num">🔴 Errors</th>';
		echo '<th class="vd-col-num">🟡 Warns</th>';
		echo '<th class="vd-col-num">🟢 Verify</th>';
		echo '<th class="vd-col-num">Overrides</th>';
		echo '<th class="vd-col-progress">' . esc_html__( 'Reviewed', 'scout-import' ) . '</th>';
		echo '<th class="vd-col-status">' . esc_html__( 'Status', 'scout-import' ) . '</th>';
		echo '<th class="vd-col-action">' . esc_html__( 'Action', 'scout-import' ) . '</th>';
		echo '</tr></thead><tbody>';

		foreach ( $themes as $theme ) {
			$s              = $theme['summary'];
			$total          = $s['total'];
			$resolved       = $s['resolved'];
			$pct            = $total > 0 ? round( ( $resolved / $total ) * 100 ) : 0;
			$override_count = self::get_override_count( $theme['post_id'] );

			if ( $resolved >= $total && $total > 0 ) {
				$status_label = '✅ Done';
				$status_class = 'done';
			} elseif ( $resolved > 0 ) {
				$status_label = '🔄 In Progress';
				$status_class = 'in_progress';
			} else {
				$status_label = '⏳ Pending';
				$status_class = 'pending';
			}

			$url = admin_url( 'admin.php?page=themescout-dashboard&theme_id=' . $theme['post_id'] );

			echo '<tr data-severity-errors="' . esc_attr( $s['errors'] ) . '" data-severity-warnings="' . esc_attr( $s['warnings'] ) . '" data-severity-info="' . esc_attr( $s['info'] ) . '" data-status="' . esc_attr( $status_class ) . '" data-overrides="' . esc_attr( $override_count ) . '">';
			echo '<td><strong>' . esc_html( $theme['title'] ) . '</strong></td>';
			echo '<td class="vd-col-id">' . esc_html( $theme['post_id'] ) . '</td>';
			echo '<td class="vd-col-num">' . ( $s['errors'] > 0 ? '<span class="vd-badge severity-error">' . esc_html( $s['errors'] ) . '</span>' : '<span class="vd-badge-muted">0</span>' ) . '</td>';
			echo '<td class="vd-col-num">' . ( $s['warnings'] > 0 ? '<span class="vd-badge severity-warning">' . esc_html( $s['warnings'] ) . '</span>' : '<span class="vd-badge-muted">0</span>' ) . '</td>';
			echo '<td class="vd-col-num">' . ( $s['info'] > 0 ? '<span class="vd-badge severity-info">' . esc_html( $s['info'] ) . '</span>' : '<span class="vd-badge-muted">0</span>' ) . '</td>';
			echo '<td class="vd-col-num">' . ( $override_count > 0 ? '<span class="vd-badge vd-badge-override">🛡️ ' . esc_html( $override_count ) . '</span>' : '<span class="vd-badge-muted">—</span>' ) . '</td>';
			echo '<td class="vd-col-progress"><div class="vd-progress-bar"><div class="vd-progress-fill" style="width:' . esc_attr( $pct ) . '%"></div></div> <span class="vd-progress-text">' . esc_html( $resolved ) . '/' . esc_html( $total ) . '</span></td>';
			echo '<td class="vd-col-status"><span class="vd-status vd-status-' . esc_attr( $status_class ) . '">' . esc_html( $status_label ) . '</span></td>';
			echo '<td class="vd-col-action"><a href="' . esc_url( $url ) . '" class="button button-small">' . ( $resolved >= $total ? esc_html__( 'Review', 'scout-import' ) : esc_html__( 'Verify', 'scout-import' ) ) . '</a></td>';
			echo '</tr>';
		}

		echo '</tbody></table>';
	}

	// ─── Single Theme Verification View ─────────────────────────────────

	/**
	 * Render the verification view for a single theme.
	 *
	 * @param int $post_id Post ID.
	 */
	private function render_theme_verification( int $post_id ): void {
		$post = get_post( $post_id );
		if ( ! $post || 'theme-profile' !== $post->post_type ) {
			echo '<div class="notice notice-error"><p>' . esc_html__( 'Theme not found.', 'scout-import' ) . '</p></div>';
			return;
		}

		$meta = get_post_meta( $post_id, '_validation_issues', true );
		if ( empty( $meta ) || empty( $meta['issues'] ) ) {
			echo '<div class="notice notice-info"><p>' . esc_html__( 'No validation issues for this theme.', 'scout-import' ) . '</p></div>';
			return;
		}

		$issues      = $meta['issues'];
		$summary     = isset( $meta['summary'] ) ? $meta['summary'] : Importer::compute_summary( $issues );
		$import_date = isset( $meta['import_date'] ) ? $meta['import_date'] : '';

		$list_url = admin_url( 'admin.php?page=themescout-dashboard' );
		echo '<a href="' . esc_url( $list_url ) . '" class="vd-back-link">← ' . esc_html__( 'Back to list', 'scout-import' ) . '</a>';

		echo '<h1 class="wp-heading-inline">' . esc_html( $post->post_title ) . ' — ' . esc_html__( 'Verification', 'scout-import' ) . '</h1>';
		echo '<hr class="wp-header-end">';

		$pct = $summary['total'] > 0 ? round( ( $summary['resolved'] / $summary['total'] ) * 100 ) : 0;
		echo '<div class="vd-summary-bar">';
		echo '<span class="vd-badge severity-error">🔴 ' . esc_html( $summary['errors'] ) . '</span>';
		echo '<span class="vd-badge severity-warning">🟡 ' . esc_html( $summary['warnings'] ) . '</span>';
		echo '<span class="vd-badge severity-info">🟢 ' . esc_html( $summary['info'] ) . '</span>';
		echo '<span class="vd-summary-progress">' . esc_html( $summary['resolved'] ) . '/' . esc_html( $summary['total'] ) . ' ' . esc_html__( 'resolved', 'scout-import' ) . '</span>';
		echo '<div class="vd-progress-bar vd-progress-wide"><div class="vd-progress-fill" style="width:' . esc_attr( $pct ) . '%"></div></div>';
		if ( $import_date ) {
			echo '<span class="vd-import-date">' . esc_html__( 'Imported:', 'scout-import' ) . ' ' . esc_html( $import_date ) . '</span>';
		}
		echo '</div>';

		echo '<div class="vd-bulk-actions" data-post-id="' . esc_attr( $post_id ) . '">';
		echo '<button type="button" class="button vd-bulk-btn" data-action="confirm_ai">' . esc_html__( 'Confirm all ✅ AI confirmed', 'scout-import' ) . '</button>';
		echo '<button type="button" class="button vd-bulk-btn" data-action="confirm_info">' . esc_html__( 'Confirm all 🟢 INFO', 'scout-import' ) . '</button>';
		echo '<button type="button" class="button vd-bulk-btn" data-action="mark_all_resolved">' . esc_html__( 'Mark all resolved', 'scout-import' ) . '</button>';
		echo '</div>';

		echo '<div class="vd-filters">';
		echo '<select id="vd-issue-filter-severity"><option value="">' . esc_html__( 'All Severities', 'scout-import' ) . '</option><option value="error">🔴 Error</option><option value="warning">🟡 Warning</option><option value="info">🟢 Info</option></select>';
		echo '<select id="vd-issue-filter-layer"><option value="">' . esc_html__( 'All Layers', 'scout-import' ) . '</option><option value="L1">L1: Structural</option><option value="L2">L2: AI Verify</option></select>';
		echo '<select id="vd-issue-filter-status"><option value="">' . esc_html__( 'All Statuses', 'scout-import' ) . '</option><option value="pending">Pending</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select>';
		echo '</div>';

		$severity_order = array( 'error' => 1, 'warning' => 2, 'info' => 3 );
		usort( $issues, function ( $a, $b ) use ( $severity_order ) {
			$sa = $severity_order[ $a['severity'] ] ?? 9;
			$sb = $severity_order[ $b['severity'] ] ?? 9;
			if ( $sa !== $sb ) {
				return $sa - $sb;
			}
			if ( $a['status'] !== $b['status'] ) {
				return ( $a['status'] === 'pending' ) ? -1 : 1;
			}
			return 0;
		} );

		$field_map = self::get_field_action_map();

		echo '<div class="vd-issues-list" data-post-id="' . esc_attr( $post_id ) . '">';

		foreach ( $issues as $issue ) {
			$this->render_issue_card( $issue, $post_id, $field_map );
		}

		echo '</div>';

		$this->render_override_panel( $post_id );
	}

	/**
	 * Render a single issue card.
	 *
	 * @param array $issue     Issue data.
	 * @param int   $post_id   Theme post ID.
	 * @param array $field_map Field action map.
	 */
	private function render_issue_card( array $issue, int $post_id, array $field_map ): void {
		$id          = esc_attr( $issue['id'] );
		$severity    = $issue['severity'];
		$layer       = $issue['layer'];
		$status      = $issue['status'] ?? 'pending';
		$is_resolved = in_array( $status, array( 'resolved', 'dismissed' ), true );

		$severity_icons = array( 'error' => '🔴 ERROR', 'warning' => '🟡 WARNING', 'info' => '🟢 VERIFY' );
		$severity_label = $severity_icons[ $severity ] ?? '🟢 INFO';

		$layer_label = ( 'L2' === $layer )
			? ( ! empty( $issue['ai_verdict'] ) ? 'L2: AI Verified' : 'L2: Unverified' )
			: 'L1: Structural';

		$field_key    = $this->extract_field_key( $issue['field'] );
		$field_config = isset( $field_map[ $field_key ] ) ? $field_map[ $field_key ] : null;
		$is_editable  = $field_config && 'readonly' !== $field_config['type'];
		$is_readonly  = $field_config && 'readonly' === $field_config['type'];

		$card_class = 'vd-issue-card severity-' . esc_attr( $severity );
		if ( $is_resolved ) {
			$card_class .= ' vd-resolved';
		}

		echo '<div class="' . esc_attr( $card_class ) . '" data-issue-id="' . $id . '" data-severity="' . esc_attr( $severity ) . '" data-layer="' . esc_attr( $layer ) . '" data-status="' . esc_attr( $status ) . '">';

		echo '<div class="vd-issue-header">';
		echo '<span class="vd-severity-badge severity-' . esc_attr( $severity ) . '">' . esc_html( $severity_label ) . '</span>';
		echo '<span class="vd-layer-badge">' . esc_html( $layer_label ) . '</span>';
		echo '<span class="vd-field-path">' . esc_html( $issue['field'] ) . '</span>';
		if ( $is_resolved ) {
			$res_label = '';
			if ( 'confirmed' === ( $issue['resolution'] ?? '' ) ) $res_label = '✅ Confirmed';
			elseif ( 'fixed' === ( $issue['resolution'] ?? '' ) ) $res_label = '🔧 Fixed';
			elseif ( 'dismissed' === $status ) $res_label = '❌ Dismissed';
			elseif ( 'skipped' === ( $issue['resolution'] ?? '' ) ) $res_label = '⏭️ Skipped';
			else $res_label = '✅ Resolved';
			echo '<span class="vd-resolved-badge">' . esc_html( $res_label ) . '</span>';
		}
		echo '</div>';

		echo '<div class="vd-issue-body">';
		echo '<div class="vd-issue-row"><span class="vd-label">' . esc_html__( 'Current value:', 'scout-import' ) . '</span> <span class="vd-value">' . esc_html( $issue['current_value'] ) . '</span></div>';
		echo '<div class="vd-issue-row"><span class="vd-label">' . esc_html__( 'Problem:', 'scout-import' ) . '</span> <span class="vd-value">' . esc_html( $issue['expected'] ) . '</span></div>';

		if ( ! empty( $issue['verify_url'] ) ) {
			echo '<div class="vd-issue-row"><span class="vd-label">' . esc_html__( 'Source:', 'scout-import' ) . '</span> <a href="' . esc_url( $issue['verify_url'] ) . '" target="_blank" rel="noopener" class="vd-source-link">' . esc_html( $issue['verify_url'] ) . ' 🔗</a></div>';
		}

		if ( ! empty( $issue['ai_verdict'] ) ) {
			echo '<div class="vd-issue-row"><span class="vd-label">AI Verdict:</span> <span class="vd-value vd-ai-verdict">' . esc_html( $issue['ai_verdict'] ) . '</span></div>';
		}

		if ( $field_config ) {
			$is_pipeline_fix = ( ! $is_editable && ! empty( $field_config['fix_instruction'] ) );
			if ( $is_editable ) {
				$type_label = '✏️ Edytowalny (' . esc_html( $field_config['acf_field'] ) . ')';
			} elseif ( $is_pipeline_fix ) {
				$type_label = '🔧 Pipeline fix required (' . esc_html( $field_config['acf_field'] ) . ')';
			} else {
				$type_label = '🔒 Readonly (' . esc_html( $field_config['acf_field'] ) . ')';
			}
			echo '<div class="vd-issue-row vd-type-label"><span class="vd-label">Typ:</span> <span class="vd-value">' . $type_label . '</span></div>';
		}

		if ( $is_readonly && ! empty( $field_config['fix_instruction'] ) ) {
			echo '<div class="vd-fix-instruction notice notice-warning inline"><p>🔧 ' . esc_html( $field_config['fix_instruction'] ) . '</p></div>';
		}

		echo '</div>';

		$is_pipeline_fix_type = ( $field_config && ! $is_editable && ! empty( $field_config['fix_instruction'] ) );
		if ( ! $is_resolved ) {
			echo '<div class="vd-issue-actions" data-post-id="' . esc_attr( $post_id ) . '">';

			if ( $is_pipeline_fix_type ) {
				echo '<button type="button" class="button vd-btn-pipeline-fix">🔧 ' . esc_html__( 'Mark for pipeline fix', 'scout-import' ) . '</button>';
				echo '<button type="button" class="button vd-btn-skip">⏭️ ' . esc_html__( 'Skip', 'scout-import' ) . '</button>';
			} else {
				if ( $is_editable ) {
					echo '<button type="button" class="button vd-btn-fix" data-field-key="' . esc_attr( $field_key ) . '">📝 ' . esc_html__( 'Fix', 'scout-import' ) . '</button>';
				}
				echo '<button type="button" class="button button-primary vd-btn-confirm">✅ ' . esc_html__( 'Confirm', 'scout-import' ) . '</button>';
				echo '<button type="button" class="button vd-btn-skip">⏭️ ' . esc_html__( 'Skip', 'scout-import' ) . '</button>';
				echo '<button type="button" class="button vd-btn-dismiss">❌ ' . esc_html__( 'Dismiss', 'scout-import' ) . '</button>';
			}

			if ( $is_editable ) {
				echo '<div class="vd-inline-editor" style="display:none;" data-acf-field="' . esc_attr( $field_config['acf_field'] ) . '" data-field-type="' . esc_attr( $field_config['type'] ) . '">';
				if ( 'repeater_append' === $field_config['type'] ) {
					$this->render_repeater_editor( $field_config, $issue['current_value'] );
				} else {
					$this->render_inline_editor( $field_config, $issue['current_value'] );
				}
				echo '</div>';
			}

			echo '</div>';
		}

		echo '<div class="vd-issue-notes">';
		echo '<label class="vd-notes-label">' . esc_html__( 'Notes:', 'scout-import' ) . '</label>';
		echo '<input type="text" class="vd-notes-input regular-text" value="' . esc_attr( $issue['notes'] ?? '' ) . '" placeholder="' . esc_attr__( 'Add a note…', 'scout-import' ) . '">';
		echo '</div>';

		echo '</div>';
	}

	/**
	 * Render inline editor for an editable field.
	 *
	 * @param array  $config        Field config from field_action_map.
	 * @param string $current_value Current value.
	 */
	private function render_inline_editor( array $config, string $current_value ): void {
		switch ( $config['type'] ) {
			case 'select':
				echo '<select class="vd-edit-input">';
				foreach ( $config['options'] as $opt ) {
					$selected = ( $opt === $current_value ) ? ' selected' : '';
					echo '<option value="' . esc_attr( $opt ) . '"' . $selected . '>' . esc_html( $opt ) . '</option>';
				}
				echo '</select>';
				break;
			case 'number':
				echo '<input type="number" class="vd-edit-input small-text" value="' . esc_attr( $current_value ) . '">';
				break;
			case 'url':
				echo '<input type="url" class="vd-edit-input regular-text" value="' . esc_attr( $current_value ) . '">';
				break;
			case 'date':
				echo '<input type="date" class="vd-edit-input" value="' . esc_attr( $current_value ) . '">';
				break;
			default:
				echo '<input type="text" class="vd-edit-input regular-text" value="' . esc_attr( $current_value ) . '">';
				break;
		}
		echo '<button type="button" class="button button-primary vd-save-edit">💾 ' . esc_html__( 'Save', 'scout-import' ) . '</button>';
		echo '<button type="button" class="button vd-cancel-edit">' . esc_html__( 'Cancel', 'scout-import' ) . '</button>';
	}

	/**
	 * Extract a recognizable field key from the field path.
	 *
	 * @param string $field_path Raw field path.
	 * @return string Normalized field key.
	 */
	private function extract_field_key( string $field_path ): string {
		$clean = preg_replace( '/^[^\w]*VERIFY:\s*/iu', '', $field_path );
		$clean = preg_replace( '/^[^\w]*SPOT\s*CHECK:\s*/iu', '', $clean );
		if ( strpos( $clean, '→' ) !== false ) {
			$parts = explode( '→', $clean );
			$clean = trim( $parts[0] );
		}
		return strtolower( trim( $clean ) );
	}

	// ─── Import Modal ───────────────────────────────────────────────────

	/**
	 * Render the import modal HTML (hidden by default).
	 */
	private function render_import_modal(): void {
		echo '<div id="vd-import-modal" class="vd-modal" style="display:none;">';
		echo '<div class="vd-modal-backdrop"></div>';
		echo '<div class="vd-modal-content">';
		echo '<h2>' . esc_html__( 'Import Validation Data', 'scout-import' ) . '</h2>';
		echo '<p>' . esc_html__( 'Paste 10-column TSV data from Google Sheets Validation tab:', 'scout-import' ) . '</p>';
		echo '<textarea id="vd-import-textarea" rows="12" class="large-text code" placeholder="Theme&#9;Field&#9;Severity&#9;Layer&#9;Current Value&#9;Expected / Issue&#9;Source to Verify&#9;AI Verdict&#9;Human Decision&#9;Notes"></textarea>';
		echo '<div class="vd-import-info">';
		echo '<p class="description">' . esc_html__( 'First row (header) will be skipped. Columns separated by tab character.', 'scout-import' ) . '</p>';
		echo '</div>';
		echo '<div class="vd-modal-footer">';
		echo '<button type="button" class="button button-primary" id="vd-import-submit">' . esc_html__( 'Import', 'scout-import' ) . '</button>';
		echo '<button type="button" class="button" id="vd-import-cancel">' . esc_html__( 'Cancel', 'scout-import' ) . '</button>';
		echo '<span class="spinner" id="vd-import-spinner"></span>';
		echo '</div>';
		echo '<div id="vd-import-result"></div>';
		echo '</div>';
		echo '</div>';
	}

	// ─── AJAX Handlers ──────────────────────────────────────────────────

	/**
	 * AJAX: Import TSV data.
	 */
	public function ajax_import_tsv(): void {
		check_ajax_referer( 'wpagent_verify', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => 'Permission denied.' ) );
		}

		$tsv_data = isset( $_POST['tsv_data'] ) ? wp_unslash( $_POST['tsv_data'] ) : '';
		if ( empty( $tsv_data ) ) {
			wp_send_json_error( array( 'message' => 'No data provided.' ) );
		}

		$result = Importer::import_tsv( $tsv_data );
		if ( $result['success'] ) {
			wp_send_json_success( $result );
		} else {
			wp_send_json_error( $result );
		}
	}

	/**
	 * AJAX: Resolve a single issue.
	 */
	public function ajax_resolve_issue(): void {
		check_ajax_referer( 'wpagent_verify', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => 'Permission denied.' ) );
		}

		$post_id  = absint( $_POST['post_id'] ?? 0 );
		$issue_id = sanitize_text_field( $_POST['issue_id'] ?? '' );
		$action   = sanitize_text_field( $_POST['resolution'] ?? 'confirmed' );
		$notes    = sanitize_text_field( $_POST['notes'] ?? '' );

		if ( ! $post_id || ! $issue_id ) {
			wp_send_json_error( array( 'message' => 'Missing post_id or issue_id.' ) );
		}

		$meta = get_post_meta( $post_id, '_validation_issues', true );
		if ( empty( $meta['issues'] ) ) {
			wp_send_json_error( array( 'message' => 'No issues found.' ) );
		}

		$found      = false;
		$new_status = 'resolved';
		foreach ( $meta['issues'] as &$issue ) {
			if ( $issue['id'] === $issue_id ) {
				if ( 'pipeline_fix' === $action ) {
					$new_status = 'pipeline_fix';
				} elseif ( 'dismissed' === $action ) {
					$new_status = 'dismissed';
				} else {
					$new_status = 'resolved';
				}
				$issue['status']      = $new_status;
				$issue['resolution']  = ( 'pipeline_fix' === $action ) ? 'pipeline_fix_needed' : $action;
				$issue['resolved_by'] = wp_get_current_user()->user_login;
				$issue['resolved_at'] = current_time( 'mysql' );
				if ( $notes ) {
					$issue['notes'] = $notes;
				}
				$found = true;
				break;
			}
		}
		unset( $issue );

		if ( ! $found ) {
			wp_send_json_error( array( 'message' => 'Issue not found.' ) );
		}

		$meta['summary'] = Importer::compute_summary( $meta['issues'] );
		update_post_meta( $post_id, '_validation_issues', $meta );

		wp_send_json_success( array(
			'issue_id' => $issue_id,
			'status'   => $new_status,
			'summary'  => $meta['summary'],
		) );
	}

	/**
	 * AJAX: Update an ACF field via inline edit.
	 */
	public function ajax_update_acf_field(): void {
		check_ajax_referer( 'wpagent_verify', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => 'Permission denied.' ) );
		}

		$post_id   = absint( $_POST['post_id'] ?? 0 );
		$issue_id  = sanitize_text_field( $_POST['issue_id'] ?? '' );
		$field_key = sanitize_text_field( $_POST['field_key'] ?? '' );
		$new_value = sanitize_text_field( $_POST['new_value'] ?? '' );

		if ( ! $post_id || ! $field_key ) {
			wp_send_json_error( array( 'message' => 'Missing required parameters.' ) );
		}

		$field_map  = self::get_field_action_map();
		$field_name = $field_key;
		$config     = null;

		if ( isset( $field_map[ $field_key ] ) ) {
			$config = $field_map[ $field_key ];
			if ( 'readonly' === $config['type'] ) {
				wp_send_json_error( array( 'message' => 'This field is read-only and cannot be edited inline.' ) );
			}
			$field_name = $config['acf_field'];
		}

		if ( isset( $config ) && 'repeater_append' === $config['type'] ) {
			$row_data = json_decode( $new_value, true );
			if ( $row_data && function_exists( 'add_row' ) ) {
				add_row( $field_name, $row_data, $post_id );
			}
		} elseif ( function_exists( 'update_field' ) ) {
			update_field( $field_name, $new_value, $post_id );
		} else {
			update_post_meta( $post_id, $field_name, $new_value );
		}

		if ( isset( $config ) && ! empty( $config['overridable'] ) ) {
			$overrides_meta = get_post_meta( $post_id, '_manual_overrides', true );
			if ( ! is_array( $overrides_meta ) ) {
				$overrides_meta = array( 'overrides' => array(), 'last_modified' => '' );
			}
			$overrides_meta['overrides'] = array_filter( $overrides_meta['overrides'], function ( $o ) use ( $field_name ) {
				return $o['field_key'] !== $field_name;
			} );
			$overrides_meta['overrides']   = array_values( $overrides_meta['overrides'] );
			$overrides_meta['overrides'][] = array(
				'field_key'      => $field_name,
				'original_value' => '',
				'override_value' => $new_value,
				'reason'         => 'Fixed via Verify Dashboard',
				'created_by'     => wp_get_current_user()->user_login,
				'created_at'     => current_time( 'c' ),
				'action'         => ( 'repeater_append' === ( $config['type'] ?? '' ) ) ? 'append' : 'update',
			);
			$overrides_meta['last_modified'] = current_time( 'c' );
			update_post_meta( $post_id, '_manual_overrides', $overrides_meta );
		}

		if ( $issue_id ) {
			$meta = get_post_meta( $post_id, '_validation_issues', true );
			if ( ! empty( $meta['issues'] ) ) {
				foreach ( $meta['issues'] as &$issue ) {
					if ( $issue['id'] === $issue_id ) {
						$issue['status']      = 'resolved';
						$issue['resolution']  = 'fixed';
						$issue['resolved_by'] = wp_get_current_user()->user_login;
						$issue['resolved_at'] = current_time( 'mysql' );
						break;
					}
				}
				unset( $issue );
				$meta['summary'] = Importer::compute_summary( $meta['issues'] );
				update_post_meta( $post_id, '_validation_issues', $meta );
			}
		}

		wp_send_json_success( array(
			'field'    => $field_name,
			'value'    => $new_value,
			'issue_id' => $issue_id,
		) );
	}

	/**
	 * AJAX: Bulk resolve issues.
	 */
	public function ajax_bulk_resolve(): void {
		check_ajax_referer( 'wpagent_verify', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => 'Permission denied.' ) );
		}

		$post_id     = absint( $_POST['post_id'] ?? 0 );
		$bulk_action = sanitize_text_field( $_POST['bulk_action'] ?? '' );

		if ( ! $post_id || ! $bulk_action ) {
			wp_send_json_error( array( 'message' => 'Missing parameters.' ) );
		}

		$meta = get_post_meta( $post_id, '_validation_issues', true );
		if ( empty( $meta['issues'] ) ) {
			wp_send_json_error( array( 'message' => 'No issues found.' ) );
		}

		$resolved_count = 0;
		$user_login     = wp_get_current_user()->user_login;
		$now            = current_time( 'mysql' );

		foreach ( $meta['issues'] as &$issue ) {
			if ( 'pending' !== $issue['status'] ) {
				continue;
			}

			$should_resolve = false;
			switch ( $bulk_action ) {
				case 'confirm_ai':
					if ( mb_strpos( $issue['ai_verdict'], '✅' ) !== false || stripos( $issue['ai_verdict'], 'confirmed' ) !== false ) {
						$should_resolve = true;
					}
					break;
				case 'confirm_info':
					if ( 'info' === $issue['severity'] ) {
						$should_resolve = true;
					}
					break;
				case 'mark_all_resolved':
					$should_resolve = true;
					break;
			}

			if ( $should_resolve ) {
				$issue['status']      = 'resolved';
				$issue['resolution']  = 'confirmed';
				$issue['resolved_by'] = $user_login;
				$issue['resolved_at'] = $now;
				$resolved_count++;
			}
		}
		unset( $issue );

		$meta['summary'] = Importer::compute_summary( $meta['issues'] );
		update_post_meta( $post_id, '_validation_issues', $meta );

		wp_send_json_success( array(
			'resolved_count' => $resolved_count,
			'summary'        => $meta['summary'],
		) );
	}

	// ─── CPT Column ─────────────────────────────────────────────────────

	/**
	 * Add Verification column to theme-profile list.
	 *
	 * @param array $columns Existing columns.
	 * @return array Modified columns.
	 */
	public function add_cpt_column( array $columns ): array {
		$columns['verification'] = __( 'Verification', 'scout-import' );
		$columns['overrides']    = __( 'Overrides', 'scout-import' );
		return $columns;
	}

	/**
	 * Render the Verification / Overrides column.
	 *
	 * @param string $column  Column name.
	 * @param int    $post_id Post ID.
	 */
	public function render_cpt_column( string $column, int $post_id ): void {
		if ( 'verification' === $column ) {
			$meta = get_post_meta( $post_id, '_validation_issues', true );
			if ( empty( $meta['summary'] ) ) {
				echo '<span class="vd-badge-muted">—</span>';
				return;
			}
			$s   = $meta['summary'];
			$url = admin_url( 'admin.php?page=themescout-dashboard&theme_id=' . $post_id );
			if ( $s['resolved'] >= $s['total'] && $s['total'] > 0 ) {
				echo '<a href="' . esc_url( $url ) . '" class="vd-cpt-badge vd-cpt-done">✅ Verified</a>';
			} elseif ( $s['errors'] > 0 ) {
				echo '<a href="' . esc_url( $url ) . '" class="vd-cpt-badge vd-cpt-error">🔴 ' . esc_html( $s['errors'] ) . ' errors</a>';
			} elseif ( $s['warnings'] > 0 ) {
				echo '<a href="' . esc_url( $url ) . '" class="vd-cpt-badge vd-cpt-warning">🟡 ' . esc_html( $s['warnings'] ) . ' warnings</a>';
			} else {
				echo '<a href="' . esc_url( $url ) . '" class="vd-cpt-badge vd-cpt-info">🟢 ' . esc_html( $s['info'] ) . ' to verify</a>';
			}
		} elseif ( 'overrides' === $column ) {
			$count = self::get_override_count( $post_id );
			if ( $count > 0 ) {
				echo '<span class="vd-badge vd-badge-override vd-cpt-override">🛡️ ' . esc_html( $count ) . '</span>';
			} else {
				echo '<span class="vd-badge-muted">—</span>';
			}
		}
	}

	// ─── Helpers ─────────────────────────────────────────────────────────

	/**
	 * Get all theme-profile posts that have _validation_issues meta.
	 *
	 * @return array Array of [ 'post_id', 'title', 'summary' ].
	 */
	private function get_themes_with_issues(): array {
		$posts = get_posts( array(
			'post_type'      => 'theme-profile',
			'post_status'    => 'publish',
			'posts_per_page' => -1,
			'meta_key'       => '_validation_issues',
			'fields'         => 'ids',
		) );

		$themes = array();
		foreach ( $posts as $pid ) {
			$meta = get_post_meta( $pid, '_validation_issues', true );
			if ( empty( $meta ) || empty( $meta['issues'] ) ) {
				continue;
			}

			$summary  = isset( $meta['summary'] ) ? $meta['summary'] : Importer::compute_summary( $meta['issues'] );
			$themes[] = array(
				'post_id' => $pid,
				'title'   => get_the_title( $pid ),
				'summary' => $summary,
			);
		}

		usort( $themes, function ( $a, $b ) {
			$a_pending = $a['summary']['total'] - $a['summary']['resolved'];
			$b_pending = $b['summary']['total'] - $b['summary']['resolved'];
			if ( $a['summary']['errors'] !== $b['summary']['errors'] ) {
				return $b['summary']['errors'] - $a['summary']['errors'];
			}
			return $b_pending - $a_pending;
		} );

		return $themes;
	}

	// ─── Override Management ────────────────────────────────────────────

	/**
	 * Render the Override Management panel on single theme view.
	 *
	 * @param int $post_id Post ID.
	 */
	private function render_override_panel( int $post_id ): void {
		$overrides_meta = get_post_meta( $post_id, '_manual_overrides', true );
		$overrides      = ( is_array( $overrides_meta ) && ! empty( $overrides_meta['overrides'] ) ) ? $overrides_meta['overrides'] : array();
		$count          = count( $overrides );

		echo '<div class="vd-override-panel" data-post-id="' . esc_attr( $post_id ) . '">';
		echo '<h2>🛡️ Manual Overrides (' . esc_html( $count ) . ' active)</h2>';
		echo '<p class="description">' . esc_html__( 'Fields protected from being overwritten by pipeline import:', 'scout-import' ) . '</p>';

		if ( empty( $overrides ) ) {
			echo '<p class="vd-no-overrides">' . esc_html__( 'No manual overrides set. Fields modified via Fix action will be automatically protected.', 'scout-import' ) . '</p>';
		} else {
			echo '<table class="wp-list-table widefat fixed striped vd-override-table">';
			echo '<thead><tr><th>' . esc_html__( 'Field', 'scout-import' ) . '</th><th>' . esc_html__( 'Value', 'scout-import' ) . '</th><th>' . esc_html__( 'Date', 'scout-import' ) . '</th><th>' . esc_html__( 'User', 'scout-import' ) . '</th><th>' . esc_html__( 'Action', 'scout-import' ) . '</th></tr></thead><tbody>';
			foreach ( $overrides as $o ) {
				$val_display = is_array( $o['override_value'] ) ? wp_json_encode( $o['override_value'] ) : $o['override_value'];
				echo '<tr class="vd-override-item" data-field="' . esc_attr( $o['field_key'] ) . '">';
				echo '<td><code>' . esc_html( $o['field_key'] ) . '</code></td>';
				echo '<td>' . esc_html( mb_strimwidth( $val_display, 0, 60, '…' ) ) . '</td>';
				echo '<td>' . esc_html( $o['created_at'] ?? '' ) . '</td>';
				echo '<td>' . esc_html( $o['created_by'] ?? '' ) . '</td>';
				echo '<td><button type="button" class="button button-small vd-remove-override" data-field="' . esc_attr( $o['field_key'] ) . '">🔓 ' . esc_html__( 'Remove', 'scout-import' ) . '</button></td>';
				echo '</tr>';
			}
			echo '</tbody></table>';
			echo '<div class="vd-override-bulk"><button type="button" class="button" id="vd-remove-all-overrides">🗑️ ' . esc_html__( 'Remove all overrides', 'scout-import' ) . '</button></div>';
		}

		echo '<p class="vd-override-warning">⚠️ ' . esc_html__( 'Removing an override means the next pipeline import will overwrite this field with AI-generated data.', 'scout-import' ) . '</p>';
		echo '</div>';
	}

	/**
	 * Render the repeater append editor for complex fields.
	 *
	 * @param array  $config        Field config.
	 * @param string $current_value Current value (for context).
	 */
	private function render_repeater_editor( array $config, string $current_value ): void {
		echo '<div class="vd-repeater-editor">';
		echo '<p class="description">' . esc_html__( 'Add a new row:', 'scout-import' ) . '</p>';
		foreach ( $config['subfields'] as $subfield ) {
			echo '<label class="vd-repeater-label">' . esc_html( $subfield ) . '</label>';
			echo '<input type="text" class="vd-repeater-input regular-text" data-subfield="' . esc_attr( $subfield ) . '" placeholder="' . esc_attr( $subfield ) . '">';
		}
		echo '<button type="button" class="button button-primary vd-save-repeater">💾 ' . esc_html__( 'Add Row', 'scout-import' ) . '</button>';
		echo '<button type="button" class="button vd-cancel-edit">' . esc_html__( 'Cancel', 'scout-import' ) . '</button>';
		echo '</div>';
	}

	/**
	 * AJAX: Remove a single override.
	 */
	public function ajax_remove_override(): void {
		check_ajax_referer( 'wpagent_verify', 'nonce' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => 'Permission denied.' ) );
		}

		$post_id   = absint( $_POST['post_id'] ?? 0 );
		$field_key = sanitize_text_field( $_POST['field_key'] ?? '' );
		if ( ! $post_id || ! $field_key ) {
			wp_send_json_error( array( 'message' => 'Missing parameters.' ) );
		}

		$meta = get_post_meta( $post_id, '_manual_overrides', true );
		if ( ! is_array( $meta ) || empty( $meta['overrides'] ) ) {
			wp_send_json_error( array( 'message' => 'No overrides found.' ) );
		}

		$meta['overrides']     = array_values( array_filter( $meta['overrides'], function ( $o ) use ( $field_key ) {
			return $o['field_key'] !== $field_key;
		} ) );
		$meta['last_modified'] = current_time( 'c' );
		update_post_meta( $post_id, '_manual_overrides', $meta );

		wp_send_json_success( array(
			'field_key' => $field_key,
			'remaining' => count( $meta['overrides'] ),
		) );
	}

	/**
	 * AJAX: Remove all overrides for a post.
	 */
	public function ajax_remove_all_overrides(): void {
		check_ajax_referer( 'wpagent_verify', 'nonce' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => 'Permission denied.' ) );
		}

		$post_id = absint( $_POST['post_id'] ?? 0 );
		if ( ! $post_id ) {
			wp_send_json_error( array( 'message' => 'Missing post_id.' ) );
		}

		update_post_meta( $post_id, '_manual_overrides', array( 'overrides' => array(), 'last_modified' => current_time( 'c' ) ) );

		wp_send_json_success( array( 'remaining' => 0 ) );
	}

	/**
	 * Get override count for a post.
	 *
	 * @param int $post_id Post ID.
	 * @return int Number of active overrides.
	 */
	public static function get_override_count( int $post_id ): int {
		$meta = get_post_meta( $post_id, '_manual_overrides', true );
		if ( is_array( $meta ) && ! empty( $meta['overrides'] ) ) {
			return count( $meta['overrides'] );
		}
		return 0;
	}
}
