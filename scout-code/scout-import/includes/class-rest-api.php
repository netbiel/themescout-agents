<?php
/**
 * Scout Import REST API
 *
 * REST endpoints for importing validation data and theme profile fields.
 *
 * @package ScoutImport
 */

namespace ScoutImport;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * REST API endpoints for validation import and theme profile field import.
 */
class Rest_API {

	/**
	 * Constructor — register REST routes.
	 */
	public function __construct() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * Register REST API routes.
	 */
	public function register_routes(): void {
		register_rest_route( 'wpagent/v1', '/validation/import', array(
			'methods'             => 'POST',
			'callback'            => array( $this, 'handle_import' ),
			'permission_callback' => array( $this, 'check_permission' ),
			'args'                => array(
				'theme'         => array(
					'required'          => true,
					'type'              => 'string',
					'sanitize_callback' => 'sanitize_text_field',
				),
				'issues'        => array(
					'required' => true,
					'type'     => 'array',
				),
				'import_source' => array(
					'required'          => false,
					'type'              => 'string',
					'default'           => 'rest_api',
					'sanitize_callback' => 'sanitize_text_field',
				),
				'import_date'   => array(
					'required'          => false,
					'type'              => 'string',
					'sanitize_callback' => 'sanitize_text_field',
				),
			),
		) );

		register_rest_route( 'wpagent/v1', '/theme-profile/import', array(
			'methods'             => 'POST',
			'callback'            => array( $this, 'handle_profile_import' ),
			'permission_callback' => array( $this, 'check_permission' ),
			'args'                => array(
				'post_id' => array(
					'required'          => true,
					'type'              => 'integer',
					'sanitize_callback' => 'absint',
				),
				'fields'  => array(
					'required' => true,
					'type'     => 'object',
				),
				'source'  => array(
					'required'          => false,
					'type'              => 'string',
					'default'           => 'pipeline',
					'sanitize_callback' => 'sanitize_text_field',
				),
			),
		) );
	}

	/**
	 * Permission check — require manage_options.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return bool|\WP_Error
	 */
	public function check_permission( \WP_REST_Request $request ) {
		if ( ! current_user_can( 'manage_options' ) ) {
			return new \WP_Error(
				'rest_forbidden',
				__( 'You do not have permission to import data.', 'scout-import' ),
				array( 'status' => 403 )
			);
		}
		return true;
	}

	/**
	 * Handle validation import request.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response
	 */
	public function handle_import( \WP_REST_Request $request ): \WP_REST_Response {
		$data   = $request->get_json_params();
		$result = Importer::import_json( $data );

		return new \WP_REST_Response( $result, $result['success'] ? 200 : 400 );
	}

	/**
	 * Handle theme profile field import with override-aware logic.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response
	 */
	public function handle_profile_import( \WP_REST_Request $request ): \WP_REST_Response {
		$post_id = absint( $request->get_param( 'post_id' ) );
		$fields  = $request->get_param( 'fields' );
		$source  = sanitize_text_field( $request->get_param( 'source' ) ?? 'pipeline' );

		$post = get_post( $post_id );
		if ( ! $post || 'theme-profile' !== $post->post_type ) {
			return new \WP_REST_Response( array(
				'success' => false,
				'message' => 'Invalid post_id or post type.',
			), 404 );
		}

		// Load manual overrides.
		$overrides_meta = get_post_meta( $post_id, '_manual_overrides', true );
		$protected_keys = array();
		if ( is_array( $overrides_meta ) && ! empty( $overrides_meta['overrides'] ) ) {
			foreach ( $overrides_meta['overrides'] as $o ) {
				$protected_keys[] = $o['field_key'];
			}
		}

		$field_map = Dashboard::get_field_action_map();
		$written   = array();
		$skipped   = array();

		foreach ( $fields as $json_key => $value ) {
			$acf_field = self::map_json_key_to_acf( $json_key, $field_map );

			if ( in_array( $acf_field, $protected_keys, true ) ) {
				$skipped[] = array(
					'json_key'  => $json_key,
					'acf_field' => $acf_field,
					'reason'    => 'Manual override exists — field protected.',
				);
				continue;
			}

			if ( function_exists( 'update_field' ) ) {
				update_field( $acf_field, $value, $post_id );
			} else {
				update_post_meta( $post_id, $acf_field, $value );
			}

			$written[] = array(
				'json_key'  => $json_key,
				'acf_field' => $acf_field,
			);
		}

		return new \WP_REST_Response( array(
			'success'       => true,
			'post_id'       => $post_id,
			'source'        => $source,
			'written'       => $written,
			'skipped'       => $skipped,
			'written_count' => count( $written ),
			'skipped_count' => count( $skipped ),
		), 200 );
	}

	/**
	 * Map a JSON key to its ACF field name using the field_action_map.
	 *
	 * @param string $json_key  JSON key from import payload.
	 * @param array  $field_map Field action map.
	 * @return string ACF field name.
	 */
	public static function map_json_key_to_acf( string $json_key, array $field_map ): string {
		if ( isset( $field_map[ $json_key ] ) ) {
			return $field_map[ $json_key ]['acf_field'];
		}
		return $json_key;
	}
}
