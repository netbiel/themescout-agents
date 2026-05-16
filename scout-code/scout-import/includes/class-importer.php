<?php
/**
 * Verification Data Importer
 *
 * Parses TSV data from Google Sheets Validation tab and saves
 * as _validation_issues post meta on theme-profile posts.
 *
 * @package ScoutImport
 */

namespace ScoutImport;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Handles TSV and JSON import of validation issues.
 */
class Importer {

	/**
	 * Import TSV data (10-column tab-separated format from Google Sheets).
	 *
	 * @param string $tsv_data Raw TSV string.
	 * @return array Result with 'success', 'themes_processed', 'issues_imported', 'errors'.
	 */
	public static function import_tsv( string $tsv_data ): array {
		$lines  = preg_split( '/\r?\n/', trim( $tsv_data ) );
		$errors = array();
		$grouped = array(); // theme_name => [ issues ]

		if ( count( $lines ) < 2 ) {
			return array(
				'success'          => false,
				'themes_processed' => 0,
				'issues_imported'  => 0,
				'errors'           => array( 'No data rows found (only header or empty input).' ),
			);
		}

		// Skip header row (index 0).
		for ( $i = 1; $i < count( $lines ); $i++ ) {
			$line = $lines[ $i ];
			if ( '' === trim( $line ) ) {
				continue;
			}

			$cols = explode( "\t", $line );

			// Rows with < 6 columns → skip with warning.
			if ( count( $cols ) < 6 ) {
				$errors[] = sprintf( 'Row %d: Skipped — only %d columns (minimum 6 required).', $i + 1, count( $cols ) );
				continue;
			}

			// Pad to 10 columns.
			while ( count( $cols ) < 10 ) {
				$cols[] = '';
			}

			$theme_name     = trim( $cols[0] );
			$field          = trim( $cols[1] );
			$severity_raw   = trim( $cols[2] );
			$layer          = trim( $cols[3] );
			$current_value  = trim( $cols[4] );
			$expected       = trim( $cols[5] );
			$verify_url     = trim( $cols[6] );
			$ai_verdict     = trim( $cols[7] );
			$human_decision = trim( $cols[8] );
			$notes          = trim( $cols[9] );

			if ( empty( $theme_name ) || empty( $field ) ) {
				$errors[] = sprintf( 'Row %d: Skipped — empty Theme or Field.', $i + 1 );
				continue;
			}

			$severity = self::normalize_severity( $severity_raw );
			$layer    = self::normalize_layer( $layer );
			$pre      = self::detect_pre_resolved( $human_decision );

			if ( ! isset( $grouped[ $theme_name ] ) ) {
				$grouped[ $theme_name ] = array();
			}

			$grouped[ $theme_name ][] = array(
				'field'         => $field,
				'severity'      => $severity,
				'layer'         => $layer,
				'current_value' => $current_value,
				'expected'      => $expected,
				'verify_url'    => $verify_url,
				'ai_verdict'    => $ai_verdict,
				'status'        => $pre['status'],
				'resolution'    => $pre['resolution'],
				'resolved_by'   => $pre['status'] === 'resolved' ? 'import' : '',
				'resolved_at'   => $pre['status'] === 'resolved' ? current_time( 'mysql' ) : '',
				'notes'         => $notes,
			);
		}

		// Save grouped issues per theme.
		$themes_processed = 0;
		$issues_imported  = 0;

		foreach ( $grouped as $theme_name => $issues ) {
			$post_id = self::find_theme_post( $theme_name );
			if ( ! $post_id ) {
				$errors[] = sprintf( 'Theme "%s": No matching theme-profile post found.', $theme_name );
				continue;
			}

			$theme_slug = sanitize_title( $theme_name );

			// Assign IDs to each issue.
			foreach ( $issues as $idx => &$issue ) {
				$issue['id'] = self::generate_issue_id( $theme_slug, $issue['field'], $idx );
			}
			unset( $issue );

			$summary = self::compute_summary( $issues );

			$meta_value = array(
				'issues'        => $issues,
				'import_date'   => current_time( 'c' ),
				'import_source' => 'google_sheets',
				'summary'       => $summary,
			);

			update_post_meta( $post_id, '_validation_issues', $meta_value );

			$themes_processed++;
			$issues_imported += count( $issues );
		}

		return array(
			'success'          => $themes_processed > 0,
			'themes_processed' => $themes_processed,
			'issues_imported'  => $issues_imported,
			'errors'           => $errors,
		);
	}

	/**
	 * Import JSON payload (REST API format).
	 *
	 * @param array $data JSON-decoded payload.
	 * @return array Result.
	 */
	public static function import_json( array $data ): array {
		$theme_name = isset( $data['theme'] ) ? sanitize_text_field( $data['theme'] ) : '';
		$issues_raw = isset( $data['issues'] ) ? $data['issues'] : array();

		if ( empty( $theme_name ) || empty( $issues_raw ) ) {
			return array(
				'success' => false,
				'errors'  => array( 'Missing theme name or issues array.' ),
			);
		}

		$post_id = self::find_theme_post( $theme_name );
		if ( ! $post_id ) {
			return array(
				'success' => false,
				'errors'  => array( sprintf( 'Theme "%s": No matching theme-profile post found.', $theme_name ) ),
			);
		}

		$theme_slug = sanitize_title( $theme_name );
		$issues     = array();

		foreach ( $issues_raw as $idx => $raw ) {
			$pre      = self::detect_pre_resolved( isset( $raw['human_decision'] ) ? $raw['human_decision'] : '' );
			$issues[] = array(
				'id'            => self::generate_issue_id( $theme_slug, $raw['field'] ?? '', $idx ),
				'field'         => sanitize_text_field( $raw['field'] ?? '' ),
				'severity'      => self::normalize_severity( $raw['severity'] ?? '' ),
				'layer'         => self::normalize_layer( $raw['layer'] ?? '' ),
				'current_value' => sanitize_text_field( $raw['current_value'] ?? '' ),
				'expected'      => sanitize_text_field( $raw['expected'] ?? '' ),
				'verify_url'    => esc_url_raw( $raw['verify_url'] ?? '' ),
				'ai_verdict'    => sanitize_text_field( $raw['ai_verdict'] ?? '' ),
				'status'        => $pre['status'],
				'resolution'    => $pre['resolution'],
				'resolved_by'   => $pre['status'] === 'resolved' ? 'import' : '',
				'resolved_at'   => $pre['status'] === 'resolved' ? current_time( 'mysql' ) : '',
				'notes'         => sanitize_textarea_field( $raw['notes'] ?? '' ),
			);
		}

		$summary    = self::compute_summary( $issues );
		$meta_value = array(
			'issues'        => $issues,
			'import_date'   => isset( $data['import_date'] ) ? sanitize_text_field( $data['import_date'] ) : current_time( 'c' ),
			'import_source' => isset( $data['import_source'] ) ? sanitize_text_field( $data['import_source'] ) : 'rest_api',
			'summary'       => $summary,
		);

		update_post_meta( $post_id, '_validation_issues', $meta_value );

		return array(
			'success'          => true,
			'themes_processed' => 1,
			'issues_imported'  => count( $issues ),
			'errors'           => array(),
		);
	}

	/**
	 * Normalize severity string.
	 * '🔴 ERROR' → 'error', '🟡 WARN' → 'warning', '🟢 INFO' → 'info'.
	 *
	 * @param string $raw Raw severity.
	 * @return string Normalized severity.
	 */
	public static function normalize_severity( string $raw ): string {
		$clean = preg_replace( '/[\x{1F000}-\x{1FFFF}]/u', '', $raw );
		$clean = strtolower( trim( $clean ) );

		if ( strpos( $clean, 'error' ) !== false ) {
			return 'error';
		}
		if ( strpos( $clean, 'warn' ) !== false ) {
			return 'warning';
		}
		if ( strpos( $clean, 'info' ) !== false ) {
			return 'info';
		}

		return $clean ?: 'info';
	}

	/**
	 * Normalize layer string.
	 *
	 * @param string $raw Raw layer.
	 * @return string Normalized (L1 or L2).
	 */
	public static function normalize_layer( string $raw ): string {
		$clean = strtoupper( trim( $raw ) );
		if ( in_array( $clean, array( 'L1', 'L2' ), true ) ) {
			return $clean;
		}
		return 'L1';
	}

	/**
	 * Detect pre-resolved status from Human Decision column.
	 *
	 * @param string $decision Human decision value.
	 * @return array ['status', 'resolution'].
	 */
	public static function detect_pre_resolved( string $decision ): array {
		if ( empty( $decision ) ) {
			return array( 'status' => 'pending', 'resolution' => '' );
		}

		if ( mb_strpos( $decision, '✅' ) !== false || stripos( $decision, 'OK' ) !== false ) {
			return array( 'status' => 'resolved', 'resolution' => 'confirmed' );
		}

		if ( mb_strpos( $decision, '🔧' ) !== false && stripos( $decision, 'pipeline' ) !== false ) {
			return array( 'status' => 'pipeline_fix', 'resolution' => 'pipeline_fix_needed' );
		}

		if ( mb_strpos( $decision, '🔧' ) !== false || stripos( $decision, 'fix' ) !== false ) {
			return array( 'status' => 'resolved', 'resolution' => 'fixed' );
		}

		return array( 'status' => 'pending', 'resolution' => '' );
	}

	/**
	 * Generate unique issue ID.
	 *
	 * @param string $theme_slug Sanitized theme slug.
	 * @param string $field      Field path.
	 * @param int    $index      Row index.
	 * @return string Unique ID.
	 */
	public static function generate_issue_id( string $theme_slug, string $field, int $index ): string {
		$clean = preg_replace( '/[\x{1F000}-\x{1FFFF}|\x{2600}-\x{27BF}|\x{FE00}-\x{FE0F}|\x{1F900}-\x{1F9FF}]/u', '', $field );
		$clean = preg_replace( '/^[^a-zA-Z0-9]*(?:VERIFY|SPOT\s*CHECK)\s*:\s*/iu', '', $clean );
		if ( strpos( $clean, '→' ) !== false ) {
			$clean = trim( explode( '→', $clean )[0] );
		}
		$field_slug = sanitize_title( mb_substr( trim( $clean ), 0, 40 ) );
		if ( empty( $field_slug ) ) {
			$field_slug = 'field';
		}
		return sprintf( '%s_%s_%03d', $theme_slug, $field_slug, $index );
	}

	/**
	 * Find a theme-profile post by title or slug.
	 *
	 * @param string $title Theme title.
	 * @return int|null Post ID or null.
	 */
	public static function find_theme_post( string $title ): ?int {
		$posts = get_posts( array(
			'post_type'      => 'theme-profile',
			'title'          => $title,
			'post_status'    => 'publish',
			'posts_per_page' => 1,
			'fields'         => 'ids',
		) );

		if ( ! empty( $posts ) ) {
			return (int) $posts[0];
		}

		$slug  = sanitize_title( $title );
		$posts = get_posts( array(
			'post_type'      => 'theme-profile',
			'name'           => $slug,
			'post_status'    => 'publish',
			'posts_per_page' => 1,
			'fields'         => 'ids',
		) );

		return ! empty( $posts ) ? (int) $posts[0] : null;
	}

	/**
	 * Compute summary counts for issues array.
	 *
	 * @param array $issues Issues array.
	 * @return array Summary with total, errors, warnings, info, resolved.
	 */
	public static function compute_summary( array $issues ): array {
		$summary = array(
			'total'    => count( $issues ),
			'errors'   => 0,
			'warnings' => 0,
			'info'     => 0,
			'resolved' => 0,
		);

		foreach ( $issues as $issue ) {
			switch ( $issue['severity'] ) {
				case 'error':
					$summary['errors']++;
					break;
				case 'warning':
					$summary['warnings']++;
					break;
				default:
					$summary['info']++;
					break;
			}
			if ( in_array( $issue['status'], array( 'resolved', 'dismissed', 'pipeline_fix' ), true ) ) {
				$summary['resolved']++;
			}
		}

		return $summary;
	}
}
