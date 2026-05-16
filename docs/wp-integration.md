# WordPress Integration

## Endpoint: POST /wpagent/v1/theme-profile/import

**Request:**
```json
{
  "post_id": 1234,
  "fields": { "...full theme JSON..." },
  "source": "python-pipeline"
}
```

**Headers:**
```
Content-Type: application/json
Authorization: Basic <base64(username:app_password)>
```

**Response (200):**
```json
{
  "success": true,
  "fields_written": 78,
  "skipped_fields": ["pricing.subscription_price"]
}
```

**Response (4xx/5xx):**
```json
{
  "error": "human-readable message",
  "details": { "..." }
}
```

**Override behavior:**
- WP plugin checks `_manual_overrides` postmeta before writing each field
- Fields listed in overrides are NOT overwritten — they appear in `skipped_fields`
- Agent does NOT manage overrides — that's WP Admin Verify Dashboard's responsibility

## Endpoint: GET /wp/v2/theme-profiles?search=<name>

Standard WP REST endpoint. Returns array of posts matching search.
Use first result if multiple (sorted by relevance). Cache the post_id.

## Agent metadata

Every import includes:
- `_agent_generated: true`
- `_agent_confidence: 0.0-1.0`
- `_agent_sources: ["python-pipeline"]`

## Safety

- Default: dry run (validate payload, no POST)
- `--no-dry-run` flag required for actual import
- Application Password auth (not user password)
