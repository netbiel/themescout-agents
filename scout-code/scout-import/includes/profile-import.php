<?php
/**
 * Scout Import — Profile Importer
 * Admin page for importing AI-generated data into ACF fields.
 * Supports 17 field groups + bulk import.
 *
 * @package ScoutImport
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Register admin page
add_action('admin_menu', 'wpagent_register_import_page');
function wpagent_register_import_page()
{
    add_submenu_page(
        'edit.php?post_type=theme-profile',
        'Import AI Data',
        'Import AI Data',
        'manage_options',
        'wpagent-import',
        'wpagent_import_page'
    );
}

// Import page HTML
function wpagent_import_page()
{
    ?>
    <div class="wrap">
        <h1>🤖 WPAgent AI Data Importer</h1>
        <p>Import AI-generated theme data from research prompts into ACF fields.</p>

        <div id="wpagent-import-container">
            <!-- Step 1: Theme Selection -->
            <div class="wpagent-import-step" id="step-theme-selection">
                <h2>Step 1: Select Theme</h2>
                <label for="theme-select">Choose existing theme or create new:</label>
                <select id="theme-select" style="width: 300px;">
                    <option value="">-- Select Theme --</option>
                    <option value="new">+ Create New Theme</option>
                    <?php
                    $themes = get_posts([
                        'post_type' => 'theme-profile',
                        'posts_per_page' => -1,
                        'post_status' => 'any'
                    ]);
                    foreach ($themes as $theme) {
                        echo '<option value="' . $theme->ID . '">' . $theme->post_title . '</option>';
                    }
                    ?>
                </select>

                <div id="new-theme-fields" style="display:none; margin-top:15px;">
                    <label for="new-theme-title">Theme Name:</label>
                    <input type="text" id="new-theme-title" placeholder="e.g., Astra Pro" style="width: 300px;">
                </div>
            </div>

            <!-- Step 2: File Upload (for demo_gallery) -->
            <div class="wpagent-import-step" id="step-file-upload" style="display:none;">
                <h2>Step 2: Upload Demo Images</h2>
                <p>Upload screenshot images for your demo gallery. These will be automatically matched with your JSON data.
                </p>

                <div id="demo-upload-area"
                    style="border: 2px dashed #ccc; padding: 40px; text-align: center; margin: 20px 0; border-radius: 8px; background: #fafafa;">
                    <div id="upload-prompt">
                        <p><strong>Drag & drop images here</strong> or <button type="button" id="select-files-btn"
                                class="button">Select Files</button></p>
                        <p><small>Supported formats: JPG, PNG, WebP | Max size: 10MB each</small></p>
                    </div>
                    <div id="upload-progress" style="display:none;">
                        <div class="upload-progress-bar"
                            style="background: #e0e0e0; height: 20px; border-radius: 10px; overflow: hidden; margin: 10px 0;">
                            <div id="progress-fill"
                                style="background: #0073aa; height: 100%; width: 0%; transition: width 0.3s;"></div>
                        </div>
                        <p id="progress-text">Uploading...</p>
                    </div>
                </div>

                <input type="file" id="demo-files-input" multiple accept="image/*" style="display: none;">

                <div id="uploaded-files-list" style="margin: 20px 0;"></div>

                <div style="margin: 20px 0;">
                    <button type="button" id="proceed-to-json" class="button button-primary" disabled>
                        Continue to Data Entry →
                    </button>
                </div>
            </div>

            <!-- Step 3: Field Group Selection -->
            <div class="wpagent-import-step" id="step-field-group" style="display:none;">
                <h2>Step 3: Select Field Group</h2>
                <label for="field-group-select">Which data type are you importing:</label>
                <select id="field-group-select" style="width: 300px;">
                    <option value="">-- Select Field Group --</option>
                    <optgroup label="Core Groups">
                        <option value="quick_overview">⚡ Quick Overview</option>
                        <option value="theme_basic">📋 Theme Basic Data</option>
                        <option value="performance_metrics">🚀 Performance Metrics</option>
                        <option value="theme_pricing">💰 Pricing & TCO</option>
                        <option value="theme_ratings">⭐ Ratings & Statistics</option>
                        <option value="theme_technical">⚙️ Technical Metadata</option>
                    </optgroup>
                    <optgroup label="Analysis & Verdicts">
                        <option value="handoff_difficulty">👥 Client Handoff Difficulty</option>
                        <option value="scenario_performance">🎯 Scenario: Performance</option>
                        <option value="scenario_updates">🔄 Scenario: Updates</option>
                        <option value="scenario_scalability">📈 Scenario: Scalability</option>
                    </optgroup>
                    <optgroup label="Plugins & Community">
                        <option value="plugin_compatibility_enhanced">🔌 Plugin Compatibility Enhanced</option>
                        <option value="community_pain_points">💬 Community Pain Points</option>
                        <option value="bundled_plugins">📦 Bundled Plugins</option>
                    </optgroup>
                    <optgroup label="Media & Demos">
                        <option value="demo_gallery">🖼️ Demo Gallery</option>
                    </optgroup>
                    <optgroup label="FAQ">
                        <option value="faq">❓ Frequently Asked Questions</option>
                    </optgroup>
                    <optgroup label="Sources & Methodology">
                        <option value="sources_methodology">📚 Sources & Methodology</option>
                    </optgroup>
                    <optgroup label="⚡ Bulk Import">
                        <option value="all_sections">🔥 All Sections (Bulk)</option>
                        <option value="search_profile">🔍 Search Profile</option>
                    </optgroup>
                </select>

                <!-- PageSpeed API Section -->
                <div id="pagespeed-api-section"
                    style="display:none; margin-top: 20px; padding: 15px; background: #f0f6fc; border: 1px solid #cce5ff; border-radius: 5px;">
                    <h3 style="margin-top:0;">🚀 Fetch from PageSpeed Insights</h3>
                    <p>Automatically fetch performance metrics for a URL.</p>

                    <div style="margin-bottom: 10px;">
                        <label for="pagespeed-url" style="display:block; margin-bottom: 5px;"><strong>Target
                                URL:</strong></label>
                        <input type="url" id="pagespeed-url" placeholder="https://example.com"
                            style="width: 100%; max-width: 500px;">
                    </div>

                    <div style="margin-bottom: 10px;">
                        <label for="pagespeed-api-key" style="display:block; margin-bottom: 5px;"><strong>Google API
                                Key:</strong> <small>(Required)</small></label>
                        <input type="password" id="pagespeed-api-key" placeholder="Enter your PageSpeed Insights API Key"
                            style="width: 100%; max-width: 500px;">
                        <p class="description" style="font-size: 12px; margin-top: 2px;">
                            <a href="https://developers.google.com/speed/docs/insights/v5/get-started" target="_blank">Get
                                an API Key</a>
                        </p>
                    </div>

                    <button type="button" id="btn-fetch-pagespeed" class="button button-primary">
                        ⚡ Fetch Metrics
                    </button>
                    <span id="pagespeed-status" style="margin-left: 10px; font-style: italic;"></span>
                </div>
            </div>

            <!-- Step 4: JSON Import -->
            <div class="wpagent-import-step" id="step-json-import" style="display:none;">
                <h2>Step 4: Enter Demo Data</h2>
                <p><strong>Instructions:</strong> Paste the complete JSON output from your AI research prompt below.</p>

                <div class="json-example" id="json-example-container"
                    style="background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 10px 0;">
                    <strong id="json-example-title">Expected JSON format:</strong>
                    <pre id="json-example-content"
                        style="font-size: 12px; color: #666;">Select a field group to see the expected JSON format</pre>
                </div>

                <label for="json-input">AI-Generated Data (JSON):</label><br>
                <textarea id="json-input" rows="15" style="width: 100%; font-family: monospace; font-size: 12px;"
                    placeholder="Paste your AI-generated JSON here..."></textarea>

                <div style="margin: 15px 0;">
                    <button type="button" id="validate-json" class="button">🔍 Validate JSON</button>
                    <button type="button" id="preview-import" class="button button-primary">👀 Preview Import</button>
                </div>

                <div id="validation-results" style="margin-top: 15px;"></div>
            </div>

            <!-- Step 5: Preview & Confirm -->
            <div class="wpagent-import-step" id="step-preview" style="display:none;">
                <h2>Step 5: Preview & Import</h2>
                <div id="import-preview"></div>

                <div style="margin: 20px 0;">
                    <label>
                        <input type="checkbox" id="confirm-import">
                        I confirm this data is accurate and ready to import
                    </label>
                </div>

                <button type="button" id="execute-import" class="button button-primary button-large" disabled>
                    🚀 Execute Import
                </button>
            </div>

            <!-- Results -->
            <div id="import-results" style="margin-top: 20px;"></div>
        </div>
    </div>

    <script>
        jQuery(document).ready(function ($) {
            // Step navigation
            $('#theme-select').change(function () {
                if ($(this).val()) {
                    if ($(this).val() === 'new') {
                        $('#new-theme-fields').show();
                    } else {
                        $('#new-theme-fields').hide();
                    }
                    // Show file upload step only for demo_gallery, otherwise go directly to field group
                    $('#step-file-upload').hide();
                    $('#step-field-group').show();
                }
            });

            $('#field-group-select').change(function () {
                const fieldGroup = $(this).val();
                if (fieldGroup) {
                    if (fieldGroup === 'demo_gallery' || fieldGroup === 'examples') {
                        // For demo gallery and examples, show file upload step first
                        $('#step-file-upload').show();
                        $('#step-json-import').hide();
                        $('#pagespeed-api-section').hide();
                    } else if (fieldGroup === 'performance_metrics') {
                        // Show PageSpeed API section
                        $('#step-file-upload').hide();
                        $('#step-json-import').show();
                        $('#pagespeed-api-section').slideDown();
                    } else {
                        // For other field groups, go directly to JSON step
                        $('#step-file-upload').hide();
                        $('#step-json-import').show();
                        $('#pagespeed-api-section').hide();
                    }
                    updateJsonExample(fieldGroup);
                }
            });

            // PageSpeed API Handler
            $('#btn-fetch-pagespeed').click(async function () {
                const url = $('#pagespeed-url').val();
                const apiKey = $('#pagespeed-api-key').val();
                const $btn = $(this);
                const $status = $('#pagespeed-status');

                if (!url) {
                    alert('Please enter a URL to test.');
                    return;
                }
                if (!apiKey) {
                    alert('Please enter a Google API Key.');
                    return;
                }

                $btn.prop('disabled', true);
                $status.text('Fetching mobile metrics...').css('color', 'blue');

                try {
                    // 1. Fetch Mobile Strategy
                    const mobileUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&key=${apiKey}`;
                    const mobileRes = await fetch(mobileUrl);
                    const mobileData = await mobileRes.json();

                    if (mobileData.error) {
                        throw new Error('Mobile Error: ' + mobileData.error.message);
                    }

                    $status.text('Fetching desktop metrics...');

                    // 2. Fetch Desktop Strategy
                    const desktopUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=desktop&key=${apiKey}`;
                    const desktopRes = await fetch(desktopUrl);
                    const desktopData = await desktopRes.json();

                    if (desktopData.error) {
                        throw new Error('Desktop Error: ' + desktopData.error.message);
                    }

                    // 3. Extract Metrics
                    // Scores are 0-1, we want 0-100
                    const mobileScore = Math.round(mobileData.lighthouseResult.categories.performance.score * 100);
                    const desktopScore = Math.round(desktopData.lighthouseResult.categories.performance.score * 100);

                    // Extract Metrics Helper
                    const getMetrics = (data) => {
                        let lcp = 0;
                        let cls = 0;
                        let source = 'Lab (Lighthouse)';

                        // 1. Try Field Data (CrUX) first - matches what users see in "Core Web Vitals"
                        if (data.loadingExperience && data.loadingExperience.metrics) {
                            const lcpMetric = data.loadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS;
                            if (lcpMetric) {
                                lcp = parseFloat((lcpMetric.percentile / 1000).toFixed(2));
                                source = 'Field (CrUX)';
                            }

                            const clsMetric = data.loadingExperience.metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE;
                            if (clsMetric) {
                                // CrUX CLS is multiplied by 100 (e.g. 3 means 0.03)
                                cls = parseFloat((clsMetric.percentile / 100).toFixed(3));
                            }
                        }

                        // 2. Fallback to Lab Data (Lighthouse)
                        if (!lcp) {
                            const lcpAudit = data.lighthouseResult.audits['largest-contentful-paint'];
                            lcp = lcpAudit && lcpAudit.numericValue ? parseFloat((lcpAudit.numericValue / 1000).toFixed(2)) : 0;
                            source = 'Lab (Lighthouse)';
                        }

                        // CLS Fallback if not found in Field
                        if (cls === 0 && !data.loadingExperience?.metrics?.CUMULATIVE_LAYOUT_SHIFT_SCORE) {
                            const clsAudit = data.lighthouseResult.audits['cumulative-layout-shift'];
                            if (clsAudit) {
                                cls = clsAudit.numericValue !== undefined ? parseFloat(clsAudit.numericValue.toFixed(3)) : 0;
                            }
                        }

                        return { lcp, cls, source };
                    };

                    const mobileMetrics = getMetrics(mobileData);
                    const desktopMetrics = getMetrics(desktopData);

                    const mobileLcp = mobileMetrics.lcp;
                    const mobileCls = mobileMetrics.cls;
                    const desktopLcp = desktopMetrics.lcp;
                    const desktopCls = desktopMetrics.cls;

                    console.log('PageSpeed API Sources:', {
                        mobile: mobileMetrics.source,
                        desktop: desktopMetrics.source
                    });

                    console.log('PageSpeed API Debug:', {
                        mobile: mobileScore,
                        desktop: desktopScore,
                        mobileLcp: mobileLcp,
                        mobileCls: mobileCls,
                        desktopLcp: desktopLcp,
                        desktopCls: desktopCls
                    });

                    // 4. Construct JSON with metadata
                    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
                    const insightsLink = `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(url)}`;

                    const resultJson = {
                        "pagespeed_mobile": mobileScore,
                        "pagespeed_desktop": desktopScore,
                        "lcp_score_mobile": mobileLcp,
                        "cls_score_mobile": mobileCls,
                        "lcp_score_desktop": desktopLcp,
                        "cls_score_desktop": desktopCls,
                        "performance_rating": Math.round((mobileScore + desktopScore) / 2),
                        "date": today,
                        "tested_url": url,
                        "pagespeed_insights_link": insightsLink
                    };

                    // 5. Populate and Validate
                    $('#json-input').val(JSON.stringify(resultJson, null, 2));
                    $('#validate-json').click(); // Trigger validation

                    $status.text('✅ Metrics fetched successfully!').css('color', 'green');

                } catch (error) {
                    console.error(error);
                    $status.text('❌ Error: ' + error.message).css('color', 'red');
                    alert('Failed to fetch metrics: ' + error.message);
                } finally {
                    $btn.prop('disabled', false);
                }
            });

            // File upload handling
            let uploadedFiles = [];

            $('#select-files-btn').click(function () {
                $('#demo-files-input').click();
            });

            $('#demo-files-input').change(function () {
                uploadFiles(this.files);
            });

            // Drag and drop
            $('#demo-upload-area').on('dragover', function (e) {
                e.preventDefault();
                $(this).css('border-color', '#0073aa');
            });

            $('#demo-upload-area').on('dragleave', function (e) {
                e.preventDefault();
                $(this).css('border-color', '#ccc');
            });

            $('#demo-upload-area').on('drop', function (e) {
                e.preventDefault();
                $(this).css('border-color', '#ccc');
                uploadFiles(e.originalEvent.dataTransfer.files);
            });

            $('#proceed-to-json').click(function () {
                $('#step-json-import').show();
                populateJsonWithFiles();
            });

            // JSON validation
            $('#validate-json').click(function () {
                const jsonText = $('#json-input').val();
                const fieldGroup = $('#field-group-select').val();

                try {
                    const data = JSON.parse(jsonText);

                    // Perform detailed validation based on field group
                    let validationResults = validateFieldGroupData(data, fieldGroup);

                    if (validationResults.valid) {
                        let successMsg = '<div style="color: green;">✅ Valid JSON format</div>';
                        if (validationResults.warnings.length > 0) {
                            successMsg += '<div style="color: orange; margin-top: 10px;"><strong>Warnings:</strong><ul>';
                            validationResults.warnings.forEach(warning => {
                                successMsg += '<li>' + warning + '</li>';
                            });
                            successMsg += '</ul></div>';
                        }
                        if (validationResults.info.length > 0) {
                            successMsg += '<div style="color: blue; margin-top: 10px;"><strong>Info:</strong><ul>';
                            validationResults.info.forEach(info => {
                                successMsg += '<li>' + info + '</li>';
                            });
                            successMsg += '</ul></div>';
                        }
                        $('#validation-results').html(successMsg);
                        $('#preview-import').prop('disabled', false);
                    } else {
                        let errorMsg = '<div style="color: red;">❌ Validation errors found:<ul>';
                        validationResults.errors.forEach(error => {
                            errorMsg += '<li>' + error + '</li>';
                        });
                        errorMsg += '</ul></div>';
                        $('#validation-results').html(errorMsg);
                        $('#preview-import').prop('disabled', true);
                    }

                } catch (e) {
                    $('#validation-results').html('<div style="color: red;">❌ Invalid JSON: ' + e.message + '</div>');
                    $('#preview-import').prop('disabled', true);
                }
            });

            function validateFieldGroupData(data, fieldGroup) {
                let result = {
                    valid: true,
                    errors: [],
                    warnings: [],
                    info: []
                };

                if (fieldGroup === 'quality_code') {
                    // Expected field definitions
                    const fieldDefs = {
                        'tested_url': { type: 'string', required: false, format: 'url' },
                        'code_quality_summary': { type: 'string', required: false },
                        'html_document_size': { type: 'number', required: false, min: 0 },
                        'total_page_size': { type: 'number', required: false, min: 0 },
                        'http_requests_count': { type: 'number', required: false, min: 0, integer: true },
                        'dom_elements_count': { type: 'number', required: false, min: 0, integer: true },
                        'html_validation_errors': { type: 'number', required: false, min: 0, integer: true },
                        'semantic_score': { type: 'number', required: false, min: 0, max: 100, integer: true },
                        'heading_structure_valid': { type: 'boolean', required: false },
                        'inline_css_size': { type: 'number', required: false, min: 0 },
                        'inline_js_size': { type: 'number', required: false, min: 0 },
                        'external_css_files': { type: 'number', required: false, min: 0, integer: true },
                        'external_js_files': { type: 'number', required: false, min: 0, integer: true },
                        'render_blocking_resources': { type: 'number', required: false, min: 0, integer: true },
                        'unused_css_percentage': { type: 'number', required: false, min: 0, max: 100 },
                        'code_quality_grade': { type: 'string', required: false, enum: ['A', 'B', 'C', 'D', 'F'] },
                        'last_code_audit': { type: 'string', required: false, format: 'date' },
                        'lighthouse_performance_score': { type: 'number', required: false, min: 0, max: 100, integer: true },
                        'accessibility_score': { type: 'number', required: false, min: 0, max: 100, integer: true },
                        'mobile_friendliness_score': { type: 'number', required: false, min: 0, max: 100, integer: true }
                    };

                    // Validate each field
                    let validFieldCount = 0;
                    Object.keys(data).forEach(fieldName => {
                        const value = data[fieldName];
                        const fieldDef = fieldDefs[fieldName];

                        if (!fieldDef) {
                            if (fieldName !== 'code_quality_details') {
                                result.warnings.push(`Unknown field: ${fieldName}`);
                            }
                            return;
                        }

                        // Skip empty strings (they will be skipped during import)
                        if (value === '') {
                            result.info.push(`Field ${fieldName} is empty - will be skipped`);
                            return;
                        }

                        validFieldCount++;

                        // Type validation
                        if (fieldDef.type === 'number') {
                            if (!isNumeric(value)) {
                                result.errors.push(`Field ${fieldName}: Expected number, got ${typeof value} (${value})`);
                                result.valid = false;
                            } else {
                                const numValue = parseFloat(value);
                                if (fieldDef.min !== undefined && numValue < fieldDef.min) {
                                    result.errors.push(`Field ${fieldName}: Value ${numValue} is below minimum ${fieldDef.min}`);
                                    result.valid = false;
                                }
                                if (fieldDef.max !== undefined && numValue > fieldDef.max) {
                                    result.errors.push(`Field ${fieldName}: Value ${numValue} is above maximum ${fieldDef.max}`);
                                    result.valid = false;
                                }
                                if (fieldDef.integer && !Number.isInteger(numValue)) {
                                    result.warnings.push(`Field ${fieldName}: Expected integer, got decimal ${numValue}`);
                                }
                            }
                        } else if (fieldDef.type === 'string') {
                            if (typeof value !== 'string') {
                                result.errors.push(`Field ${fieldName}: Expected string, got ${typeof value}`);
                                result.valid = false;
                            } else if (fieldDef.enum && !fieldDef.enum.includes(value)) {
                                result.errors.push(`Field ${fieldName}: Value "${value}" not in allowed values: ${fieldDef.enum.join(', ')}`);
                                result.valid = false;
                            } else if (fieldDef.format === 'url' && !isValidUrl(value)) {
                                result.errors.push(`Field ${fieldName}: Invalid URL format: ${value}`);
                                result.valid = false;
                            } else if (fieldDef.format === 'date' && !isValidDate(value)) {
                                result.warnings.push(`Field ${fieldName}: Invalid date format: ${value} (expected YYYY-MM-DD)`);
                            }
                        } else if (fieldDef.type === 'boolean') {
                            if (typeof value !== 'boolean') {
                                result.warnings.push(`Field ${fieldName}: Expected boolean, got ${typeof value} - will be converted`);
                            }
                        }
                    });

                    // Validate code_quality_details if present
                    if (data.code_quality_details) {
                        if (!Array.isArray(data.code_quality_details)) {
                            result.errors.push('code_quality_details: Expected array');
                            result.valid = false;
                        } else {
                            data.code_quality_details.forEach((detail, index) => {
                                const requiredFields = ['test_tool', 'test_metric', 'test_value'];
                                requiredFields.forEach(field => {
                                    if (!detail[field]) {
                                        result.errors.push(`code_quality_details[${index}]: Missing required field ${field}`);
                                        result.valid = false;
                                    }
                                });

                                const validTools = ['lighthouse', 'gtmetrix', 'pagespeed', 'w3c_validator', 'webpagetest', 'custom'];
                                if (detail.test_tool && !validTools.includes(detail.test_tool)) {
                                    result.warnings.push(`code_quality_details[${index}]: Unknown test_tool "${detail.test_tool}"`);
                                }

                                const validBenchmarks = ['excellent', 'good', 'average', 'poor', 'critical'];
                                if (detail.test_benchmark && !validBenchmarks.includes(detail.test_benchmark)) {
                                    if (detail.test_benchmark === 'needs improvement') {
                                        result.info.push(`code_quality_details[${index}]: "needs improvement" will be converted to "average"`);
                                    } else {
                                        result.warnings.push(`code_quality_details[${index}]: Unknown benchmark "${detail.test_benchmark}"`);
                                    }
                                }
                            });
                            validFieldCount++;
                        }
                    }

                    if (validFieldCount === 0) {
                        result.errors.push('No valid fields found for import');
                        result.valid = false;
                    } else {
                        result.info.push(`${validFieldCount} fields ready for import`);
                    }
                } else if (fieldGroup === 'search_profile') {
                    if (data.search_profile && typeof data.search_profile === 'string' && data.search_profile.trim() !== '') {
                        result.info.push('Valid search_profile string found');
                    } else {
                        result.errors.push('Missing or empty "search_profile" string');
                        result.valid = false;
                    }
                }

                return result;
            }

            function isNumeric(value) {
                return !isNaN(parseFloat(value)) && isFinite(value);
            }

            function isValidUrl(string) {
                try {
                    new URL(string);
                    return true;
                } catch (_) {
                    return false;
                }
            }

            function isValidDate(dateString) {
                const regex = /^\d{4}-\d{2}-\d{2}$/;
                if (!regex.test(dateString)) return false;
                const date = new Date(dateString);
                return date instanceof Date && !isNaN(date) && dateString === date.toISOString().split('T')[0];
            }

            // Preview import
            $('#preview-import').click(function () {
                const jsonText = $('#json-input').val();
                const fieldGroup = $('#field-group-select').val();
                const themeId = $('#theme-select').val();

                // Generate preview based on field group type
                generateImportPreview(JSON.parse(jsonText), fieldGroup);
                $('#step-preview').show();
            });

            // Confirm checkbox
            $('#confirm-import').change(function () {
                $('#execute-import').prop('disabled', !$(this).is(':checked'));
            });

            // Execute import
            $('#execute-import').click(function () {
                const jsonData = JSON.parse($('#json-input').val());
                const fieldGroup = $('#field-group-select').val();
                const themeId = $('#theme-select').val();
                const themeName = $('#new-theme-title').val();

                executeImport(jsonData, fieldGroup, themeId, themeName);
            });

            function updateJsonExample(fieldGroup) {
                const examples = {
                    'bundled_plugins': {
                        title: 'Expected JSON format for Bundled Plugins:',
                        content: `{
  "bundled_plugins": [
    {
      "plugin_name": "Elementor Pro",
      "plugin_category": "page-builder",
      "plugin_value": 59,
      "license_type": "lifetime",
      "plugin_functionality": "Advanced drag-and-drop page builder..."
    }
  ]
}`
                    },
                    'quality_code': {
                        title: 'Expected JSON format for Code Quality Analysis:',
                        content: `{
  "tested_url": "https://demo.themename.com",
  "code_quality_summary": "The theme demonstrates excellent performance with fast loading times and clean code structure. Minor improvements needed in accessibility compliance and CSS optimization.",
  "html_document_size": 45.2,
  "total_page_size": 1250.5,
  "http_requests_count": 23,
  "dom_elements_count": 1456,
  "html_validation_errors": 0,
  "semantic_score": 85,
  "heading_structure_valid": true,
  "inline_css_size": 12.3,
  "inline_js_size": 8.7,
  "external_css_files": 3,
  "external_js_files": 5,
  "render_blocking_resources": 2,
  "unused_css_percentage": 25.6,
  "code_quality_grade": "B",
  "last_code_audit": "2025-01-15",
  "lighthouse_performance_score": 92,
  "accessibility_score": 88,
  "mobile_friendliness_score": 95,
  "code_quality_details": [
    {
      "test_tool": "lighthouse",
      "test_metric": "First Contentful Paint",
      "test_value": "1.2s",
      "test_benchmark": "good",
      "test_notes": "Faster than 75% of websites"
    }
  ]
}`
                    },
                    'performance_metrics': {
                        title: 'Expected JSON format for Performance Metrics:',
                        content: `{
  "pagespeed_mobile": 85,
  "pagespeed_desktop": 92,
  "lcp_score_mobile": 2.1,
  "cls_score_mobile": 0.05,
  "lcp_score_desktop": 1.2,
  "cls_score_desktop": 0.01,
  "performance_rating": 88,
  "date": "2024-12-29",
  "tested_url": "https://demo.theme.com",
  "pagespeed_insights_link": "https://pagespeed.web.dev/analysis?url=https://demo.theme.com"
}

Notes:
- pagespeed_mobile/desktop: PageSpeed scores 0-100
- lcp_score_mobile/desktop: Largest Contentful Paint in seconds
- cls_score_mobile/desktop: Cumulative Layout Shift (0-1, lower is better)
- performance_rating: Overall performance rating 0-100 (optional)
- date: Test date in YYYY-MM-DD format
- tested_url: URL of the tested page
- pagespeed_insights_link: Link to full PageSpeed Insights report`
                    },
                    'compatibility_manual': {
                        title: 'Expected JSON format for Plugin Compatibility:',
                        content: `{
  "plugin_compatibility": [
    {
      "plugin_name": "WooCommerce",
      "functionality": "E-commerce",
      "compatibility_score": 95,
      "compatibility_status": "fully_compatible",
      "compatibility_notes": "Fully tested and optimized"
    }
  ]
}`
                    },
                    'examples': {
                        title: 'Expected JSON format for Implementation Examples:',
                        content: `{
  "example_sites": [
    {
      "example_title": "Corporate Website",
      "example_url": "https://example.com",
      "example_description": "Professional corporate website using this theme",
      "example_screenshot_filename": "corporate-example.jpg"
    },
    {
      "example_title": "Portfolio Site",
      "example_url": "https://portfolio.example.com",
      "example_description": "Creative portfolio showcase",
      "example_screenshot_filename": "portfolio-example.png"
    }
  ]
}

Note: Upload images first, then this JSON template will be auto-generated for you!`
                    },
                    'demo_gallery': {
                        title: 'Expected JSON format for Demo Gallery:',
                        content: `{
  "demo_gallery": [
    {
      "demo_name": "Corporate Homepage",
      "demo_url": "https://demo.theme.com/corporate",
      "demo_description": "Professional corporate layout with clean design",
      "demo_category": "business",
      "demo_featured": true,
      "demo_thumbnail_filename": "corporate-homepage.jpg"
    },
    {
      "demo_name": "Portfolio Style",
      "demo_url": "https://demo.theme.com/portfolio",
      "demo_description": "Creative portfolio showcase layout",
      "demo_category": "portfolio",
      "demo_featured": false,
      "demo_thumbnail_filename": "portfolio-style.png"
    }
  ]
}

Note: Upload images first, then this JSON template will be auto-generated for you!`
                    },
                    'ratings': {
                        title: 'Expected JSON format for Ratings & Statistics:',
                        content: `{
  "popularity_trend": "growing",
  "external_ratings": [
    {
      "rating_source": "ThemeForest",
      "rating_score": 4.7,
      "rating_count": 850,
      "rating_url": "https://themeforest.net/item/theme-name/12345"
    },
    {
      "rating_source": "WordPress.org",
      "rating_score": 4.3,
      "rating_count": 400,
      "rating_url": "https://wordpress.org/themes/theme-name/"
    },
    {
      "rating_source": "Trustpilot",
      "rating_score": 4.5,
      "rating_count": 125,
      "rating_url": "https://www.trustpilot.com/review/example.com"
    }
  ]
}

Notes:
- popularity_trend: Must be one of: "growing", "stable", or "declining"
- rating_score: Number between 0-5 (can use decimals like 4.7)
- rating_count: Integer number of reviews
- rating_url: Valid URL to the review source`
                    },
                    'ai_summary': {
                        title: 'Expected JSON format for AI Summary Analysis:',
                        content: `{
  "ai_summary": "This theme is a powerful and versatile WordPress solution designed for modern websites. It excels in performance optimization with lightweight code and fast loading times, making it ideal for businesses that prioritize user experience and SEO rankings.\\n\\nThe theme offers extensive customization options through an intuitive interface, allowing users to create unique designs without coding knowledge. It includes pre-built templates, drag-and-drop functionality, and comprehensive documentation that makes it accessible to both beginners and advanced users.\\n\\nWhile the theme provides excellent value with its feature set, users should note that some advanced features may require premium plugins. The learning curve for mastering all customization options can be steep initially, but the investment pays off in the long run with a highly professional and performant website.",
  "review_sample_size": 1250,
  "ai_summary_source": "ThemeForest Reviews",
  "ai_confidence_score": 92,
  "ai_summary_last_updated": "2025-10-03"
}

Notes:
- ai_summary: 3-paragraph AI-generated theme analysis (use \\\\n\\\\n for paragraph breaks)
- review_sample_size: Number of reviews analyzed (integer)
- ai_summary_source: Source of data (e.g., "ThemeForest Reviews", "WordPress.org", "Mixed Sources")
- ai_confidence_score: Confidence level 0-100 (integer)
- ai_summary_last_updated: Date in YYYY-MM-DD format`
                    },
                    'handoff_difficulty': {
                        title: 'Expected JSON format for Client Handoff Difficulty (MVP):',
                        content: `{
  "handoff_score": 7.5,
  "handoff_panel_complexity": "advanced_power_user",
  "handoff_docs_quality": "excellent",
  "handoff_learning_curve": "steep_initial",
  "handoff_recommendation": "This theme requires comprehensive training for clients. Recommend creating custom video tutorials and a simplified admin guide. Consider 2-3 training sessions focusing on core content updates first, then advanced features."
}

Notes:
- handoff_score: Number 1-10 (1=Easy, 10=Very Difficult) - decimal allowed
- handoff_panel_complexity: One of: "simple_basic", "moderate_intermediate", "advanced_power_user"
- handoff_docs_quality: One of: "poor", "basic", "good", "excellent"
- handoff_learning_curve: One of: "minimal_intuitive", "moderate_few_hours", "steep_initial", "ongoing_training"
- handoff_recommendation: Text recommendation for developers on how to train clients`
                    },
                    'community_pain_points': {
                        title: 'Expected JSON format for Community Pain Points Analysis (MVP):',
                        content: `{
  "community_total_discussions": 156,
  "community_analysis_date": "2025-01-10",
  "community_timeframe": "Last 12 months",
  "community_methodology_note": "Analyzed Reddit r/WordPress, r/webdev, ThemeForest reviews, and official support forums using AI-powered sentiment analysis and keyword extraction.",
  "community_pain_points": [
    {
      "severity": "🔴 Critical",
      "frequency": "Mentioned in 45% of discussions",
      "title": "Page Builder Performance Issues",
      "description": "Users report slow loading times when using the bundled page builder with multiple widgets. Sites with 10+ sections experience significant lag.",
      "discussions": [
        {
          "text": "Reddit: Divi page builder making site extremely slow",
          "url": "https://reddit.com/r/WordPress/comments/example1",
          "votes": "127 upvotes"
        },
        {
          "text": "ThemeForest: Performance degradation with builder",
          "url": "https://themeforest.net/item/example",
          "votes": "89 helpful"
        }
      ],
      "resolution": "Developers recommend limiting sections to 8 per page, enabling caching plugins, and using static blocks where possible. Version 5.2 improved performance by 30%."
    },
    {
      "severity": "🟠 High",
      "frequency": "Mentioned in 28% of discussions",
      "title": "Documentation Gaps for Advanced Features",
      "description": "While basic documentation is good, advanced customization features lack detailed guides, forcing users to rely on community forums.",
      "discussions": [
        {
          "text": "Reddit: Where is documentation for custom headers?",
          "url": "https://reddit.com/r/WordPress/comments/example2",
          "votes": "64 upvotes"
        }
      ],
      "resolution": "Community members created unofficial video tutorials. Official team plans comprehensive docs update in Q2 2025."
    }
  ],
  "community_praise_stats": [
    {
      "percentage": 78,
      "text": "Praise design flexibility and customization options"
    },
    {
      "percentage": 65,
      "text": "Appreciate responsive customer support"
    },
    {
      "percentage": 52,
      "text": "Value the extensive template library"
    }
  ]
}

Notes:
- community_total_discussions: Integer number of discussions analyzed
- community_analysis_date: Date in YYYY-MM-DD format
- community_timeframe: Descriptive text (e.g., "Last 12 months", "Past 6 months")
- severity: One of: "🔴 Critical", "🟠 High", "🟡 Medium", "🟢 Low"
- frequency: Descriptive text (e.g., "Mentioned in 45% of discussions")
- discussions: Array of source links with text, url, and optional votes/metric
- resolution: Text describing how to resolve or workaround the issue
- praise_stats: Array with percentage (0-100) and text description`
                    },
                    'plugin_compatibility_enhanced': {
                        title: 'Expected JSON format for Plugin Compatibility Enhanced (MVP):',
                        content: `{
  "compat_total_tested": 25,
  "compat_full_compatible": 18,
  "compat_issues_found": 7,
  "plugin_compatibility_list": [
    {
      "plugin": "WooCommerce",
      "plugin_category": "ecommerce",
      "compatibility_status": "full",
      "compatibility_notes": "Fully tested with WooCommerce 8.5. Includes custom product page templates and optimized checkout.",
      "user_issues": []
    },
    {
      "plugin": "Yoast SEO",
      "plugin_category": "seo",
      "compatibility_status": "partial",
      "compatibility_notes": "Works well but breadcrumbs styling requires custom CSS adjustments.",
      "user_issues": [
        {
          "severity": "medium",
          "title": "Breadcrumb Styling Conflicts",
          "description": "Default breadcrumb styles from Yoast clash with theme header design, causing layout breaks on mobile devices.",
          "sources": [
            {
              "type": "reddit",
              "url": "https://reddit.com/r/WordPress/comments/example3",
              "metric": "34 upvotes"
            },
            {
              "type": "support_forum",
              "url": "https://wordpress.org/support/topic/example",
              "metric": "Marked as resolved"
            }
          ],
          "resolution": "Add custom CSS to override breadcrumb container styles. Code snippet available in theme documentation under Yoast Integration section."
        }
      ]
    },
    {
      "plugin": "Elementor Pro",
      "plugin_category": "page_builder",
      "compatibility_status": "full",
      "compatibility_notes": "Fully compatible. Theme includes Elementor-specific widget library and custom templates.",
      "user_issues": [
        {
          "severity": "low",
          "title": "Theme Builder Template Priority",
          "description": "When both theme templates and Elementor templates are active, Elementor takes priority which may cause confusion for new users.",
          "sources": [
            {
              "type": "facebook",
              "url": "https://facebook.com/groups/elementor/posts/example",
              "metric": "12 reactions"
            }
          ],
          "resolution": "This is expected behavior. Use Elementor Theme Builder for full control, or disable Elementor templates to use theme defaults."
        }
      ]
    }
  ]
}

Notes:
- compat_total_tested: Integer number of plugins tested
- compat_full_compatible: Integer number fully compatible
- compat_issues_found: Integer number with issues
- plugin: STRING - Plugin name (e.g., "WooCommerce", "Yoast SEO").
  The importer will automatically find existing plugin in taxonomy or create new term.
  Use exact plugin names to match existing taxonomy terms when possible.
- plugin_category: One of: "page_builder", "ecommerce", "seo", "forms", "media", "social", "booking", "membership", "multilingual", "performance", "security", "analytics", "design", "content", "woocommerce_addon", "other"
- compatibility_status: One of: "full", "partial", "limited", "none", "untested"
- user_issues: Array of issue objects (can be empty [] if no issues)
- issue severity: One of: "high", "medium", "low"
- issue sources type: One of: "reddit", "facebook", "support_forum", "github", "other"
- All URLs should be valid and publicly accessible

IMPORTANT: The "plugin" field accepts a STRING (plugin name), not a term ID.
The importer handles taxonomy term lookup/creation automatically.`
                    },
                    'quick_overview': {
                        title: 'Expected JSON format for Quick Overview:',
                        content: `{
  "quick_verdict": "Powerful theme with extensive customization. Requires experience.",
  "quick_pros": [
    {"pro_text": "90+ pre-built demos"},
    {"pro_text": "WooCommerce optimized"},
    {"pro_text": "Excellent documentation"}
  ],
  "quick_cons": [
    {"con_text": "Performance needs optimization"},
    {"con_text": "Steep learning curve"}
  ]
}`
                    },
                    'theme_basic': {
                        title: 'Expected JSON format for Theme Basic Data:',
                        content: `{
  "theme_author": "ThemeForest Author",
  "theme_version": "7.4.2",
  "release_date": "2018-01-15",
  "last_update": "2024-11-20",
  "code_quality": "intermediate",
  "theme_tagline": "#1 Bestselling Theme",
  "sales_count": "950,000+",
  "demo_url": "https://demo.theme.com",
  "affiliate_url": "https://themeforest.net/item/theme/12345"
}`
                    },
                    'scenario_performance': {
                        title: 'Expected JSON format for Scenario: Performance:',
                        content: `{
  "perf_confidence": "medium",
  "perf_sources_count": 8,
  "perf_verdict_safe": "Small to medium sites with proper caching",
  "perf_verdict_caution": "High-traffic sites - optimize carefully",
  "perf_verdict_avoid": "Budget hosting with limited resources",
  "perf_recommendation": "Use premium hosting, enable caching, optimize images",
  "perf_alternative_themes": "GeneratePress, Kadence"
}`
                    },
                    'scenario_updates': {
                        title: 'Expected JSON format for Scenario: Updates:',
                        content: `{
  "updates_confidence": "high",
  "updates_sources_count": 25,
  "updates_verdict_safe": "Active development with regular updates",
  "updates_verdict_caution": "Heavy customizations - test in staging",
  "updates_verdict_avoid": "No active development",
  "updates_recommendation": "Always use staging. Keep backups before updating.",
  "updates_alternative_themes": "Astra, Neve"
}`
                    },
                    'scenario_scalability': {
                        title: 'Expected JSON format for Scenario: Scalability:',
                        content: `{
  "scale_confidence": "high",
  "scale_sources_count": 10,
  "scale_verdict_safe": "Building template for 10+ client projects",
  "scale_verdict_caution": "Very specific customizations needed",
  "scale_verdict_avoid": "Quick turnaround projects",
  "scale_recommendation": "Create reusable child theme. Document customizations.",
  "scale_alternative_themes": "GeneratePress Pro, Hello Elementor"
}`
                    },
                    'theme_pricing': {
                        title: 'Expected JSON format for Pricing & TCO:',
                        content: `{
  "license_type": "standard_commercial",
  "pricing_model": "one_time_purchase",
  "base_price": 59,
  "support_period_included": 12,
  "support_renewal_cost": 19,
  "update_policy": "support_period_updates",
  "pricing_tiers": [
    {
      "tier_name": "Extended License",
      "tier_price": 2950,
      "tier_type": "extended_license",
      "tier_description": "For SaaS products where end users are charged"
    }
  ]
}`
                    },
                    'theme_ratings': {
                        title: 'Expected JSON format for Ratings & Statistics:',
                        content: `{
  "popularity_trend": "growing",
  "external_ratings": [
    {
      "rating_source": "ThemeForest",
      "rating_score": 4.8,
      "rating_count": 25000,
      "rating_url": "https://themeforest.net/item/theme/reviews"
    }
  ]
}`
                    },
                    'theme_technical': {
                        title: 'Expected JSON format for Technical Metadata:',
                        content: `{
  "min_wp_version": "5.8",
  "min_php_version": "7.4",
  "wp_compatibility": "6.4",
  "last_verification": "2024-11-20",
  "activity_status": "active"
}`
                    },
                    'sources_methodology': {
                        title: 'Expected JSON format for Sources & Methodology:',
                        content: `{
  "methodology_note": "Analyzed Reddit r/WordPress, r/webdev, ThemeForest comments, and WP.org forums. Focus on professional freelancer and agency discussions from the last 12 months.",
  "analysis_date": "2025-10-25",
  "data_timeframe": "Last 12 months",
  "confidence_statement": "HIGH confidence - 150+ discussions analyzed, consistent patterns across multiple sources.",
  "sources": [
    {
      "source_id": "[1]",
      "source_name": "Reddit r/WordPress",
      "source_url": "https://reddit.com/r/wordpress/comments/example",
      "source_type": "forum"
    },
    {
      "source_name": "ThemeForest Reviews",
      "source_id": "[2]",
      "source_url": "https://themeforest.net/item/theme/reviews",
      "source_type": "review_site"
    }
  ]
}

Notes:
- source_type options: forum, review_site, official, social, marketplace, documentation`
                    },
                    'faq': {
                        title: 'Expected JSON format for FAQ Section:',
                        content: `{
  "faq_generation_note": "Generated from 55 community sources, Dec 2025",
  "faq_items": [
    {
      "faq_question": "Does WoodMart work with Yoast SEO?",
      "faq_answer": "Yes, fully compatible. Users report no conflicts with Yoast SEO breadcrumbs or meta settings [1][5]. The theme's schema markup integrates seamlessly with Yoast's structured data.",
      "faq_category": "compatibility",
      "faq_source_ids": "1,5"
    },
    {
      "faq_question": "Will updates break my site?",
      "faq_answer": "High risk. Users report critical errors after major updates [13][14]. Always test on staging first. Developer recommends disabling all customizations before updating.",
      "faq_category": "updates",
      "faq_source_ids": "13,14"
    },
    {
      "faq_question": "Is this theme good for beginners?",
      "faq_answer": "No. The theme has a steep learning curve and requires technical knowledge [3]. Better suited for experienced developers or agencies. Consider simpler alternatives for clients.",
      "faq_category": "handoff",
      "faq_source_ids": "3"
    }
  ]
}

Notes:
- faq_display is AUTO-SET: true when items > 0, false when items = 0
- faq_category options: compatibility, performance, updates, handoff, pricing, support, general
- Use [ID] references in faq_answer to link to sources
- faq_source_ids: comma-separated list for validation`
                    },
                    'all_sections': {
                        title: 'Expected JSON format for All Sections (Bulk Import):',
                        content: `{
  "human_summary": {
    "summary_paragraphs": [
      "First paragraph of summary...",
      "Second paragraph...",
      "Third paragraph..."
    ]
  },
  "quick_overview": {
    "quick_verdict": "Brief verdict about the theme...",
    "quick_pros": [{"pro_text": "Major advantage"}],
    "quick_cons": [{"con_text": "Potential issue"}]
  },
  "theme_basic": {
    "theme_author": "Author Name",
    "theme_version": "1.0.0",
    "release_date": "2023-01-01"
  },
  "performance_metrics": {
    "pagespeed_mobile": 85,
    "pagespeed_desktop": 92
  },
  "sources_methodology": {
    "methodology_note": "Analyzed Reddit r/WordPress...",
    "analysis_date": "2025-12-07",
    "data_timeframe": "Last 12 months",
    "confidence_statement": "HIGH confidence...",
    "sources": [{"source_id": "[1]", "source_name": "...", "source_url": "...", "source_type": "forum"}]
  },
  "handoff_difficulty": {
    "handoff_score": 7.5,
    "handoff_panel_complexity": "advanced_power_user"
  },
  "scenario_performance": { ... },
  "scenario_updates": { ... },
  "scenario_scalability": { ... },
  "theme_pricing": { ... },
  "plugin_compatibility_enhanced": { ... },
  "community_pain_points": { "community_pain_points": [...] },
  "bundled_plugins": { "bundled_plugins": [...] },
  "faq": {
    "faq_items": [...]
  }
}

Notes:
- human_summary: Converts summary_paragraphs to Gutenberg blocks
  * Plain text → auto-wrapped in <!-- wp:paragraph --> blocks
  * Already formatted blocks → used as-is
  * Saves to WordPress post_content
- Include only the sections you want to import
- Each section uses its standard structure
- Missing sections will be skipped`
                    },
                    'search_profile': {
                        title: 'Expected JSON format for Search Profile:',
                        content: `{
  "search_profile": "Storefront|perf:needs_work(51mob,60desk)|price:free|handoff:7/moderate|ideal:developers,agencies|avoid:beginners|tags:elementor,wordpress-org"
}

Notes:
- search_profile: A single string with pipe-separated values used for search filtering.`
                    }
                };

                if (examples[fieldGroup]) {
                    $('#json-example-title').text(examples[fieldGroup].title);
                    $('#json-example-content').text(examples[fieldGroup].content);
                }
            }

            function generateImportPreview(data, fieldGroup) {
                let preview = '<div class="import-preview-container">';

                // Special handling for Bundled Plugins
                if (fieldGroup === 'bundled_plugins' && data.bundled_plugins) {
                    preview += '<h3>📦 Bundled Plugins to Import:</h3>';
                    data.bundled_plugins.forEach(plugin => {
                        preview += `
                        <div class="plugin-preview" style="border: 1px solid #ccc; padding: 10px; margin: 5px 0;">
                            <strong>${plugin.plugin_name}</strong>
                            <span style="color: #666;">(${plugin.plugin_category})</span><br>
                            <small>Value: $${plugin.plugin_value} | License: ${plugin.license_type}</small><br>
                            <em>${plugin.plugin_functionality}</em>
                        </div>
                    `;
                    });
                }
                // Special handling for Demo Gallery
                else if (fieldGroup === 'demo_gallery' && data.demo_gallery) {
                    preview += '<h3>🖼️ Demo Gallery to Import:</h3>';
                    preview += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px;">';
                    data.demo_gallery.forEach((demo, index) => {
                        const featuredBadge = demo.demo_featured ? '<span style="background: #ff6b35; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-left: 10px;">Featured</span>' : '';
                        preview += `
                        <div style="border: 1px solid #ddd; padding: 15px; border-radius: 8px; background: white;">
                            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                                <strong>${demo.demo_name}</strong>
                                ${featuredBadge}
                            </div>
                            <div style="margin-bottom: 8px;">
                                <strong>🌐 URL:</strong> <a href="${demo.demo_url}" target="_blank" style="color: #0073aa;">${demo.demo_url}</a>
                            </div>
                            ${demo.demo_thumbnail_filename ? `
                            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee;">
                                <strong>🖼️ Image:</strong> <code style="background: #f5f5f5; padding: 2px 4px; border-radius: 3px;">${demo.demo_thumbnail_filename}</code>
                            </div>` : ''}
                        </div>
                    `;
                    });
                    preview += '</div>';
                }
                // Special handling for Plugin Compatibility Enhanced
                else if (fieldGroup === 'plugin_compatibility_enhanced' && data.plugin_compatibility_list) {
                    preview += '<h3>🔌 Plugin Compatibility List:</h3>';
                    data.plugin_compatibility_list.forEach(item => {
                        preview += `
                        <div style="border: 1px solid #eee; padding: 10px; margin-bottom: 5px; background: #fff;">
                            <strong>${item.plugin}</strong> - Status: ${item.compatibility_status}
                            ${item.user_issues ? `<br><small>Issues: ${item.user_issues.length}</small>` : ''}
                        </div>
                    `;
                    });
                }
                // Special handling for Community Pain Points
                else if (fieldGroup === 'community_pain_points' && data.pain_points_list) {
                    preview += '<h3>😩 Community Pain Points:</h3>';
                    data.pain_points_list.forEach(point => {
                        preview += `
                        <div style="border: 1px solid #eee; padding: 10px; margin-bottom: 5px; background: #fff;">
                            <strong>${point.pain_point_title}</strong> (Severity: ${point.severity})
                            <br><small>${point.description ? point.description.substring(0, 100) + '...' : ''}</small>
                        </div>
                    `;
                    });
                }
                // Special handling for Sources & Methodology
                else if (fieldGroup === 'sources_methodology' && data.sources) {
                    preview += '<h3>📚 Sources & Methodology:</h3>';
                    preview += '<div style="margin-bottom: 15px;">';
                    if (data.methodology_note) preview += `<div><strong>Note:</strong> ${data.methodology_note}</div>`;
                    if (data.confidence_statement) preview += `<div><strong>Confidence:</strong> ${data.confidence_statement}</div>`;
                    preview += '</div>';

                    preview += '<h4>Sources List:</h4>';
                    data.sources.forEach(source => {
                        preview += `
                        <div style="border: 1px solid #eee; padding: 10px; margin-bottom: 5px; background: #fff;">
                            <strong>${source.source_id} ${source.source_name}</strong> (${source.source_type})
                            <br><small><a href="${source.source_url}" target="_blank">${source.source_url}</a></small>
                        </div>
                    `;
                    });
                }
                // Special handling for All Sections (Bulk Import)
                else if (fieldGroup === 'all_sections') {
                    preview += '<h3>🔥 Bulk Import - All Sections</h3>';
                    preview += '<p style="background: #fff3cd; padding: 10px; border-radius: 5px; border-left: 4px solid #ffc107;">This will import multiple sections at once. Review each section below:</p>';
                    preview += '<div style="display: grid; gap: 15px; margin-top: 15px;">';

                    const sectionNames = {
                        'human_summary': '📝 Human Summary (post_content)',
                        'quick_overview': '⚡ Quick Overview',
                        'theme_basic': '📝 Theme Basic Data',
                        'performance_metrics': '🚀 Performance Metrics',
                        'demo_gallery': '🖼️ Demo Gallery',
                        'sources_methodology': '📚 Sources & Methodology',
                        'handoff_difficulty': '👥 Client Handoff Difficulty',
                        'scenario_performance': '⚡ Scenario: Performance',
                        'scenario_updates': '🔄 Scenario: Updates',
                        'scenario_scalability': '📈 Scenario: Scalability',
                        'theme_pricing': '💰 Theme Pricing',
                        'theme_ratings': '⭐ Theme Ratings',
                        'theme_technical': '⚙️ Technical Metadata',
                        'community_pain_points': '💬 Community Pain Points',
                        'faq': '❓ FAQ Section',
                        'plugin_compatibility_enhanced': '🔌 Plugin Compatibility Enhanced',
                        'bundled_plugins': '📦 Bundled Plugins'
                    };

                    for (const [section, sectionData] of Object.entries(data)) {
                        let sectionName = sectionNames[section] || section.replace(/_/g, ' ');
                        let fieldCount = typeof sectionData === 'object' ? Object.keys(sectionData).length : 0;
                        let itemsCount = '';

                        if (sectionData.sources && Array.isArray(sectionData.sources)) {
                            itemsCount = ` (${sectionData.sources.length} sources)`;
                        } else if (sectionData.pain_points && Array.isArray(sectionData.pain_points)) {
                            itemsCount = ` (${sectionData.pain_points.length} pain points)`;
                        } else if (sectionData.demo_gallery && Array.isArray(sectionData.demo_gallery)) {
                            itemsCount = ` (${sectionData.demo_gallery.length} demos)`;
                        }

                        preview += `
                        <div style="border: 1px solid #ddd; padding: 12px; border-radius: 5px; background: #f9f9f9;">
                            <strong>${sectionName}</strong>${itemsCount}
                            <br><small style="color: #666;">${fieldCount} fields to import</small>
                        </div>
                    `;
                    }

                    preview += '</div>';
                }
                // Special handling for Search Profile
                else if (fieldGroup === 'search_profile' && data.search_profile) {
                    preview += '<h3>🔍 Search Profile:</h3>';
                    preview += '<div style="background: #f0f0f0; padding: 10px; border-radius: 4px; font-family: monospace; word-break: break-all;">';
                    preview += data.search_profile;
                    preview += '</div>';
                }
                // Generic handler for all other groups (Key-Value pairs)
                else {
                    preview += `<h3>📄 Preview for ${fieldGroup.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</h3>`;
                    preview += '<table class="widefat striped" style="margin-top: 10px;"><tbody>';

                    for (const [key, value] of Object.entries(data)) {
                        // Skip complex arrays if not handled above
                        if (Array.isArray(value)) {
                            preview += `<tr><td><strong>${key}</strong></td><td><em>Array (${value.length} items) - Detailed preview not available</em></td></tr>`;
                            continue;
                        }
                        // Skip objects
                        if (typeof value === 'object' && value !== null) {
                            continue;
                        }

                        preview += `<tr>
                        <td style="width: 200px;"><strong>${key}</strong></td>
                        <td>${value}</td>
                    </tr>`;
                    }
                    preview += '</tbody></table>';
                }

                preview += '</div>';
                $('#import-preview').html(preview);
            }
            function executeImport(data, fieldGroup, themeId, themeName) {
                // AJAX call to import data
                $.ajax({
                    url: ajaxurl,
                    method: 'POST',
                    data: {
                        action: 'wpagent_import_data',
                        json_data: JSON.stringify(data),
                        field_group: fieldGroup,
                        theme_id: themeId,
                        theme_name: themeName,
                        nonce: '<?php echo wp_create_nonce("wpagent_import"); ?>'
                    },
                    success: function (response) {
                        if (response.success) {
                            $('#import-results').html('<div class="notice notice-success"><p>✅ Import completed successfully!</p></div>');
                            if (response.data.redirect) {
                                setTimeout(() => {
                                    window.location.href = response.data.redirect;
                                }, 2000);
                            }
                        } else {
                            let errorHtml = '<div class="notice notice-error"><p>❌ Import failed: ' + response.data.message + '</p></div>';
                            $('#import-results').html(errorHtml);
                        }
                    },
                    error: function (xhr, status, error) {
                        let errorMsg = 'AJAX Error: ' + error;
                        if (xhr.responseJSON && xhr.responseJSON.data && xhr.responseJSON.data.message) {
                            errorMsg = xhr.responseJSON.data.message;
                        }
                        $('#import-results').html('<div class="notice notice-error"><p>❌ Request failed: ' + errorMsg + '</p></div>');
                    }
                });
            }

            function uploadFiles(files) {
                if (files.length === 0) return;

                $('#upload-prompt').hide();
                $('#upload-progress').show();

                let formData = new FormData();
                Array.from(files).forEach((file, index) => {
                    formData.append('files[]', file);
                });
                formData.append('action', 'wpagent_upload_demo_images');
                formData.append('nonce', '<?php echo wp_create_nonce("wpagent_upload"); ?>');

                $.ajax({
                    url: ajaxurl,
                    type: 'POST',
                    data: formData,
                    processData: false,
                    contentType: false,
                    xhr: function () {
                        let xhr = new window.XMLHttpRequest();
                        xhr.upload.addEventListener('progress', function (e) {
                            if (e.lengthComputable) {
                                let percentComplete = (e.loaded / e.total) * 100;
                                $('#progress-fill').css('width', percentComplete + '%');
                                $('#progress-text').text('Uploading... ' + Math.round(percentComplete) + '%');
                            }
                        });
                        return xhr;
                    },
                    success: function (response) {
                        $('#upload-progress').hide();
                        if (response.success) {
                            uploadedFiles = response.data.files;
                            displayUploadedFiles();
                            $('#proceed-to-json').prop('disabled', false);
                        } else {
                            alert('Upload failed: ' + response.data.message);
                            $('#upload-prompt').show();
                        }
                    },
                    error: function () {
                        $('#upload-progress').hide();
                        $('#upload-prompt').show();
                        alert('Upload failed. Please try again.');
                    }
                });
            }

            function displayUploadedFiles() {
                let html = '<h4>✅ Uploaded Files (' + uploadedFiles.length + '):</h4>';
                html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px;">';

                uploadedFiles.forEach(file => {
                    html += `
                    <div style="border: 1px solid #ddd; padding: 10px; border-radius: 5px; text-align: center;">
                        <img src="${file.url}" style="max-width: 100%; height: 100px; object-fit: cover; border-radius: 3px;">
                        <div style="margin-top: 5px; font-size: 12px; word-break: break-all;">
                            <strong>${file.filename}</strong>
                        </div>
                    </div>
                `;
                });

                html += '</div>';
                $('#uploaded-files-list').html(html);
            }

            function populateJsonWithFiles() {
                if (uploadedFiles.length === 0) return;

                const fieldGroup = $('#field-group-select').val();
                let templateData = {};

                if (fieldGroup === 'demo_gallery') {
                    templateData = {
                        "demo_gallery": []
                    };

                    uploadedFiles.forEach((file, index) => {
                        let demoName = file.filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").replace(/\b\w/g, l => l.toUpperCase());

                        templateData.demo_gallery.push({
                            "demo_name": demoName,
                            "demo_url": "https://demo.theme.com/" + file.filename.replace(/\.[^/.]+$/, "").toLowerCase(),
                            "demo_description": "Description for " + demoName,
                            "demo_category": "business",
                            "demo_featured": index === 0,
                            "demo_thumbnail_filename": file.filename
                        });
                    });
                } else if (fieldGroup === 'examples') {
                    templateData = {
                        "example_sites": []
                    };

                    uploadedFiles.forEach((file, index) => {
                        let siteName = file.filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").replace(/\b\w/g, l => l.toUpperCase());

                        templateData.example_sites.push({
                            "example_title": siteName,
                            "example_url": "https://example.com/" + file.filename.replace(/\.[^/.]+$/, "").toLowerCase(),
                            "example_description": "Real-world implementation of " + siteName + " using this theme",
                            "example_screenshot_filename": file.filename
                        });
                    });
                }

                $('#json-input').val(JSON.stringify(templateData, null, 2));

                // Show helpful message
                let fieldGroupName = fieldGroup === 'demo_gallery' ? 'demo gallery' : 'implementation examples';
                $('#validation-results').html(`
                <div style="color: green;">
                    ✅ JSON template populated with ${uploadedFiles.length} uploaded files for ${fieldGroupName}!
                    <br><small>Please review and modify the titles, URLs, and descriptions as needed.</small>
                </div>
            `);
            }
        });
    </script>

    <style>
        .wpagent-import-step {
            background: #fff;
            border: 1px solid #ccd0d4;
            border-radius: 5px;
            padding: 20px;
            margin: 20px 0;
        }

        .wpagent-import-step h2 {
            margin-top: 0;
            color: #23282d;
        }

        .json-example {
            font-family: monospace;
        }

        .plugin-preview {
            background: #f9f9f9;
        }

        .import-preview-container {
            max-height: 400px;
            overflow-y: auto;
            border: 1px solid #ddd;
            padding: 15px;
            background: #fafafa;
        }
    </style>
    <?php
}

// AJAX handler for import
add_action('wp_ajax_wpagent_import_data', 'wpagent_handle_import');
function wpagent_handle_import()
{
    // Verify nonce
    if (!wp_verify_nonce($_POST['nonce'], 'wpagent_import')) {
        wp_die('Security check failed');
    }

    $json_data = json_decode(stripslashes($_POST['json_data']), true);
    $field_group = sanitize_text_field($_POST['field_group']);
    $theme_id = intval($_POST['theme_id']);
    $theme_name = sanitize_text_field($_POST['theme_name']);

    error_log("WPAgent Importer: DEBUG - Incoming request for theme ID: $theme_id | field_group: $field_group");
    if (is_array($json_data)) {
        error_log("WPAgent Importer: DEBUG - Incoming JSON keys at root: " . implode(', ', array_keys($json_data)));
    } else {
        error_log("WPAgent Importer: DEBUG - Incoming JSON is NOT an array/object! JSON string: " . substr(stripslashes($_POST['json_data']), 0, 100));
    }

    // Create new theme if needed
    if ($theme_id === 0 && !empty($theme_name)) {
        $theme_id = wp_insert_post([
            'post_title' => $theme_name,
            'post_type' => 'theme-profile',
            'post_status' => 'draft'
        ]);

        if (is_wp_error($theme_id)) {
            wp_send_json_error(['message' => 'Failed to create theme: ' . $theme_id->get_error_message()]);
        }
    }

    if (!$theme_id || $theme_id <= 0) {
        wp_send_json_error(['message' => 'Could not create or find theme. Theme ID: ' . $theme_id]);
    }

    // Verify post exists and is correct type
    $post = get_post($theme_id);
    if (!$post || $post->post_type !== 'theme-profile') {
        error_log("Invalid theme post: $theme_id");
        wp_send_json_error(['message' => 'Invalid theme post. Post type: ' . ($post ? $post->post_type : 'not found')]);
    }

    error_log("Starting import for group: $field_group on theme: $theme_id");

    $result = false;
    $error_message = '';

    try {
        switch ($field_group) {
            case 'quick_overview':
                if (function_exists('import_quick_overview'))
                    $result = import_quick_overview($theme_id, $json_data);
                else
                    $error_message = 'Function import_quick_overview missing';
                break;
            case 'theme_basic':
                if (function_exists('import_theme_basic'))
                    $result = import_theme_basic($theme_id, $json_data);
                else
                    $error_message = 'Function import_theme_basic missing';
                break;
            case 'performance_metrics':
                if (function_exists('import_performance_metrics'))
                    $result = import_performance_metrics($theme_id, $json_data);
                else
                    $error_message = 'Function import_performance_metrics missing';
                break;
            case 'theme_pricing':
                if (function_exists('import_theme_pricing'))
                    $result = import_theme_pricing($theme_id, $json_data);
                else
                    $error_message = 'Function import_theme_pricing missing';
                break;
            case 'theme_ratings':
                if (function_exists('import_theme_ratings'))
                    $result = import_theme_ratings($theme_id, $json_data);
                else
                    $error_message = 'Function import_theme_ratings missing';
                break;
            case 'theme_technical':
                if (function_exists('import_theme_technical'))
                    $result = import_theme_technical($theme_id, $json_data);
                else
                    $error_message = 'Function import_theme_technical missing';
                break;
            case 'handoff_difficulty':
                if (function_exists('import_handoff_difficulty'))
                    $result = import_handoff_difficulty($theme_id, $json_data);
                else
                    $error_message = 'Function import_handoff_difficulty missing';
                break;
            case 'scenario_performance':
                if (function_exists('import_scenario_performance'))
                    $result = import_scenario_performance($theme_id, $json_data);
                else
                    $error_message = 'Function import_scenario_performance missing';
                break;
            case 'scenario_updates':
                if (function_exists('import_scenario_updates'))
                    $result = import_scenario_updates($theme_id, $json_data);
                else
                    $error_message = 'Function import_scenario_updates missing';
                break;
            case 'scenario_scalability':
                if (function_exists('import_scenario_scalability'))
                    $result = import_scenario_scalability($theme_id, $json_data);
                else
                    $error_message = 'Function import_scenario_scalability missing';
                break;
            case 'plugin_compatibility_enhanced':
                if (function_exists('import_plugin_compatibility_enhanced'))
                    $result = import_plugin_compatibility_enhanced($theme_id, $json_data);
                else
                    $error_message = 'Function import_plugin_compatibility_enhanced missing';
                break;
            case 'community_pain_points':
                if (function_exists('import_community_pain_points'))
                    $result = import_community_pain_points($theme_id, $json_data, $error_message);
                else
                    $error_message = 'Function import_community_pain_points missing';
                break;
            case 'bundled_plugins':
                if (function_exists('import_bundled_plugins'))
                    $result = import_bundled_plugins($theme_id, $json_data);
                else
                    $error_message = 'Function import_bundled_plugins missing';
                break;
            case 'demo_gallery':
                if (function_exists('import_demo_gallery'))
                    $result = import_demo_gallery($theme_id, $json_data, $error_message);
                else
                    $error_message = 'Function import_demo_gallery missing';
                break;
            case 'sources_methodology':
                if (function_exists('import_sources_methodology'))
                    $result = import_sources_methodology($theme_id, $json_data);
                else
                    $error_message = 'Function import_sources_methodology missing';
                break;
            case 'faq':
                if (function_exists('import_faq'))
                    $result = import_faq($theme_id, $json_data);
                else
                    $error_message = 'Function import_faq missing';
                break;
            case 'all_sections':
                if (function_exists('wpagent_handle_bulk_import')) {
                    $result = wpagent_handle_bulk_import($theme_id, $json_data);
                } else {
                    $error_message = 'Function wpagent_handle_bulk_import missing';
                }
                break;
            case 'search_profile':
                if (function_exists('import_search_profile'))
                    $result = import_search_profile($theme_id, $json_data);
                else
                    $error_message = 'Function import_search_profile missing';
                break;
            default:
                $error_message = 'Unknown field group: ' . $field_group;
                error_log($error_message);
                $result = false;
        }
    } catch (Exception $e) {
        $error_message = 'Exception: ' . $e->getMessage();
        error_log($error_message);
        $result = false;
    }

    if ($result) {
        wp_send_json_success([
            'message' => 'Data imported successfully',
            'redirect' => admin_url('post.php?post=' . $theme_id . '&action=edit')
        ]);
    } else {
        wp_send_json_error(['message' => 'Import failed' . (!empty($error_message) ? ': ' . $error_message : '')]);
    }
}

// Import functions for each field group
function import_bundled_plugins($theme_id, $data)
{
    if (!function_exists('update_field') || !function_exists('add_row') || !function_exists('delete_field')) {
        error_log('WPAgent Import: ACF functions missing for bundled_plugins');
        return false;
    }

    // Support both formats:
    // 1. Direct: {"bundled_plugins": [array of plugins]}
    // 2. Nested: {"bundled_plugins": {"bundled_plugins": [array of plugins]}}
    $plugins_data = null;

    if (isset($data['bundled_plugins']) && is_array($data['bundled_plugins'])) {
        // Check if it's nested format
        if (isset($data['bundled_plugins']['bundled_plugins']) && is_array($data['bundled_plugins']['bundled_plugins'])) {
            $plugins_data = $data['bundled_plugins']['bundled_plugins'];
            error_log('WPAgent Import: Using nested bundled_plugins format');
        }
        // Check if it's direct array of plugins (first item has plugin_name)
        else if (isset($data['bundled_plugins'][0]) && is_array($data['bundled_plugins'][0])) {
            $plugins_data = $data['bundled_plugins'];
            error_log('WPAgent Import: Using direct bundled_plugins array format');
        }
    }

    if (!$plugins_data) {
        error_log('WPAgent Import: No valid bundled_plugins data found. Data structure: ' . print_r($data, true));
        return false;
    }

    error_log('WPAgent Import: Found ' . count($plugins_data) . ' plugins to import');

    // Clear existing rows first using the field key
    delete_field('field_bundled_plugins', $theme_id);

    $imported_count = 0;

    // Add each plugin as a new row
    foreach ($plugins_data as $index => $plugin) {
        if (empty($plugin['plugin_name'])) {
            error_log("WPAgent Import: Skipping plugin at index {$index} - missing plugin_name");
            continue;
        }

        $row = [
            'plugin_name' => sanitize_text_field($plugin['plugin_name']),
            'plugin_category' => sanitize_text_field($plugin['plugin_category'] ?? 'other'),
            'plugin_value' => floatval($plugin['plugin_value'] ?? 0),
            'license_type' => sanitize_text_field($plugin['license_type'] ?? 'included'),
            'plugin_functionality' => sanitize_textarea_field($plugin['plugin_functionality'] ?? '')
        ];

        error_log("WPAgent Import: Adding plugin '{$row['plugin_name']}' (category: {$row['plugin_category']}, value: {$row['plugin_value']})");

        // Add row using the repeater field key
        $result = add_row('field_bundled_plugins', $row, $theme_id);

        if ($result) {
            $imported_count++;
        } else {
            error_log("WPAgent Import: Failed to add row for plugin '{$row['plugin_name']}'");
        }
    }

    error_log("WPAgent Import: Successfully imported {$imported_count} of " . count($plugins_data) . " plugins");

    return $imported_count > 0;
}

function import_performance_metrics($theme_id, $data)
{
    // Implementation for performance metrics import
    // Support both old and new field name formats
    $fields_to_update = [
        'pagespeed_mobile' => intval($data['pagespeed_mobile'] ?? 0),
        'pagespeed_desktop' => intval($data['pagespeed_desktop'] ?? 0),
        // Support both 'lcp_mobile' and 'lcp_score_mobile' formats
        'lcp_score_mobile' => floatval($data['lcp_score_mobile'] ?? $data['lcp_mobile'] ?? 0),
        'cls_score_mobile' => floatval($data['cls_score_mobile'] ?? $data['cls_mobile'] ?? 0),
        'lcp_score_desktop' => floatval($data['lcp_score_desktop'] ?? $data['lcp_desktop'] ?? 0),
        'cls_score_desktop' => floatval($data['cls_score_desktop'] ?? $data['cls_desktop'] ?? 0),
        'performance_rating' => intval($data['performance_rating'] ?? 0)
    ];

    $processed = 0;
    foreach ($fields_to_update as $field => $value) {
        if ($value > 0) {
            update_field($field, $value, $theme_id);
            $processed++;
        }
    }

    // Handle text fields (test metadata)
    // Support both 'test_date'/'date', 'test_url'/'tested_url', 'pagespeed_link'/'pagespeed_insights_link'
    $text_fields = [
        'date' => sanitize_text_field($data['date'] ?? $data['test_date'] ?? ''),
        'tested_url' => esc_url_raw($data['tested_url'] ?? $data['test_url'] ?? ''),
        'pagespeed_insights_link' => esc_url_raw($data['pagespeed_insights_link'] ?? $data['pagespeed_link'] ?? '')
    ];

    foreach ($text_fields as $field => $value) {
        if (!empty($value)) {
            update_field($field, $value, $theme_id);
            $processed++;
        }
    }

    return $processed > 0;
}

function import_plugin_compatibility($theme_id, $data)
{
    // Implementation for plugin compatibility import
    if (!isset($data['plugin_compatibility']) || !is_array($data['plugin_compatibility'])) {
        return false;
    }

    $compatibility_data = [];
    foreach ($data['plugin_compatibility'] as $item) {
        $compatibility_data[] = [
            'plugin_name' => sanitize_text_field($item['plugin_name']),
            'functionality' => sanitize_text_field($item['functionality']),
            'compatibility_score' => intval($item['compatibility_score']),
            'compatibility_status' => sanitize_text_field($item['compatibility_status']),
            'compatibility_notes' => sanitize_textarea_field($item['compatibility_notes'] ?? '')
        ];
    }

    return update_field('plugin_compatibility_manual', $compatibility_data, $theme_id);
}


function import_demo_gallery($theme_id, $data, &$error_message = '')
{
    // Check if ACF is active
    if (!function_exists('update_field')) {
        $error_message = 'ACF plugin not active or update_field function not available';
        return false;
    }

    // Check if post exists
    if (!get_post($theme_id)) {
        $error_message = 'Post with ID ' . $theme_id . ' does not exist';
        return false;
    }

    // Validate input data
    if (!isset($data['demo_gallery']) || !is_array($data['demo_gallery'])) {
        $error_message = 'No demo_gallery array found in data';
        return false;
    }

    $demo_gallery_data = [];
    $imported_demos = [];
    $failed_demos = [];
    $skipped_demos = [];

    foreach ($data['demo_gallery'] as $index => $demo) {
        // Validate required fields
        if (empty($demo['demo_name']) || empty($demo['demo_url'])) {
            $skipped_demos[] = "Demo $index: Missing required fields (demo_name or demo_url)";
            continue;
        }

        // Find attachment by filename if provided
        $attachment_id = null;
        if (!empty($demo['demo_thumbnail_filename'])) {
            $attachment_id = find_attachment_by_filename($demo['demo_thumbnail_filename']);

            if (!$attachment_id) {
                $failed_demos[] = "Demo '{$demo['demo_name']}': Image '{$demo['demo_thumbnail_filename']}' not found in media library";
                // Don't skip - continue without image
            }
        }

        // Prepare demo data
        $demo_item = [
            'demo_name' => sanitize_text_field($demo['demo_name']),
            'demo_url' => esc_url_raw($demo['demo_url']),
            'demo_description' => sanitize_textarea_field(isset($demo['demo_description']) ? $demo['demo_description'] : ''),
            'demo_category' => sanitize_text_field(isset($demo['demo_category']) ? $demo['demo_category'] : ''),
            'demo_featured' => (bool) (isset($demo['demo_featured']) ? $demo['demo_featured'] : false)
        ];

        // Add attachment if found
        if ($attachment_id) {
            $demo_item['demo_thumbnail'] = $attachment_id;
        }

        $demo_gallery_data[] = $demo_item;
        $imported_demos[] = $demo['demo_name'] . ($attachment_id ? ' (with image)' : ' (no image)');
    }

    if (empty($demo_gallery_data)) {
        $error_message = 'No valid demo items to import';
        return false;
    }

    // Import to ACF field
    $result = update_field('demo_gallery', $demo_gallery_data, $theme_id);

    // Build status message
    $messages = [];
    if (!empty($imported_demos)) {
        $messages[] = "Imported: " . implode(', ', $imported_demos);
    }
    if (!empty($skipped_demos)) {
        $messages[] = "Skipped: " . implode(', ', $skipped_demos);
    }
    if (!empty($failed_demos)) {
        $messages[] = "Image issues: " . implode(', ', $failed_demos);
    }

    $error_message = implode(' | ', $messages);

    return $result;
}

/**
 * Find attachment ID by filename
 */
function find_attachment_by_filename($filename)
{
    // Remove extension for more flexible matching
    $name_without_ext = pathinfo($filename, PATHINFO_FILENAME);

    // Search by post_title (filename without extension)
    $attachments = get_posts([
        'post_type' => 'attachment',
        'post_status' => 'inherit',
        'posts_per_page' => 1,
        'meta_query' => [
            [
                'key' => '_wp_attached_file',
                'value' => $filename,
                'compare' => 'LIKE'
            ]
        ]
    ]);

    if (!empty($attachments)) {
        return $attachments[0]->ID;
    }

    // Alternative search by post_title
    $attachments = get_posts([
        'post_type' => 'attachment',
        'post_status' => 'inherit',
        'posts_per_page' => 1,
        'title' => $name_without_ext
    ]);

    if (!empty($attachments)) {
        return $attachments[0]->ID;
    }

    // Search in post_title with LIKE
    $attachments = get_posts([
        'post_type' => 'attachment',
        'post_status' => 'inherit',
        'posts_per_page' => 1,
        's' => $name_without_ext
    ]);

    if (!empty($attachments)) {
        return $attachments[0]->ID;
    }

    return null;
}

/**
 * AJAX handler for uploading demo images
 */
add_action('wp_ajax_wpagent_upload_demo_images', 'wpagent_handle_demo_upload');
function wpagent_handle_demo_upload()
{
    // Verify nonce
    if (!wp_verify_nonce($_POST['nonce'], 'wpagent_upload')) {
        wp_send_json_error(['message' => 'Security check failed']);
        return;
    }

    // Check if user can upload files
    if (!current_user_can('upload_files')) {
        wp_send_json_error(['message' => 'You do not have permission to upload files']);
        return;
    }

    // Check if files were uploaded
    if (empty($_FILES['files'])) {
        wp_send_json_error(['message' => 'No files were uploaded']);
        return;
    }

    $uploaded_files = [];
    $errors = [];

    // Process each uploaded file
    $file_count = count($_FILES['files']['name']);
    for ($i = 0; $i < $file_count; $i++) {
        // Skip empty file slots
        if (empty($_FILES['files']['name'][$i])) {
            continue;
        }

        // Prepare file data
        $file = [
            'name' => $_FILES['files']['name'][$i],
            'type' => $_FILES['files']['type'][$i],
            'tmp_name' => $_FILES['files']['tmp_name'][$i],
            'error' => $_FILES['files']['error'][$i],
            'size' => $_FILES['files']['size'][$i]
        ];

        // Validate file
        if ($file['error'] !== UPLOAD_ERR_OK) {
            $errors[] = "File {$file['name']}: Upload error code {$file['error']}";
            continue;
        }

        // Check file size (10MB limit)
        if ($file['size'] > 10 * 1024 * 1024) {
            $errors[] = "File {$file['name']}: File too large (max 10MB)";
            continue;
        }

        // Check file type
        $allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        if (!in_array($file['type'], $allowed_types)) {
            $errors[] = "File {$file['name']}: Invalid file type. Only JPG, PNG, WebP and GIF are allowed";
            continue;
        }

        // Use WordPress upload handling
        $upload_overrides = [
            'test_form' => false
        ];

        $movefile = wp_handle_upload($file, $upload_overrides);

        if ($movefile && !isset($movefile['error'])) {
            // Create attachment
            $attachment = [
                'post_mime_type' => $movefile['type'],
                'post_title' => sanitize_file_name(pathinfo($movefile['file'], PATHINFO_FILENAME)),
                'post_content' => '',
                'post_status' => 'inherit'
            ];

            $attachment_id = wp_insert_attachment($attachment, $movefile['file']);

            if (!is_wp_error($attachment_id)) {
                // Generate attachment metadata
                require_once(ABSPATH . 'wp-admin/includes/image.php');
                $attach_data = wp_generate_attachment_metadata($attachment_id, $movefile['file']);
                wp_update_attachment_metadata($attachment_id, $attach_data);

                $uploaded_files[] = [
                    'id' => $attachment_id,
                    'filename' => basename($movefile['file']),
                    'url' => $movefile['url'],
                    'type' => $movefile['type']
                ];
            } else {
                $errors[] = "File {$file['name']}: Failed to create attachment - " . $attachment_id->get_error_message();
            }
        } else {
            $errors[] = "File {$file['name']}: Upload failed - " . (isset($movefile['error']) ? $movefile['error'] : 'Unknown error');
        }
    }

    if (empty($uploaded_files) && !empty($errors)) {
        wp_send_json_error(['message' => 'All uploads failed: ' . implode(', ', $errors)]);
        return;
    }

    $response_data = [
        'files' => $uploaded_files,
        'message' => count($uploaded_files) . ' files uploaded successfully'
    ];

    if (!empty($errors)) {
        $response_data['warnings'] = $errors;
        $response_data['message'] .= ' (with ' . count($errors) . ' errors)';
    }

    wp_send_json_success($response_data);
}



/**
 * Import Client Handoff Difficulty data (MVP)
 */
function import_handoff_difficulty($theme_id, $data, &$error_message = '')
{
    // Check if ACF is active
    if (!function_exists('update_field')) {
        $error_message = 'ACF plugin not active or update_field function not available';
        return false;
    }

    // Check if post exists
    if (!get_post($theme_id)) {
        $error_message = 'Post with ID ' . $theme_id . ' does not exist';
        return false;
    }

    $success = true;
    $imported_fields = [];
    $skipped_fields = [];
    $failed_fields = [];

    // List of ALL handoff difficulty fields (updated to match FINAL.json)
    $handoff_fields = [
        'handoff_score',
        'handoff_panel_complexity',
        'handoff_docs_quality',
        'handoff_learning_curve',
        'handoff_recommendation',
        'handoff_confidence',
        'handoff_sources_count',
        'handoff_verdict_safe',
        'handoff_verdict_caution',
        'handoff_verdict_avoid',
        'handoff_alternative_themes'
    ];

    // Import each field
    foreach ($handoff_fields as $field) {
        if (isset($data[$field])) {
            $value = $data[$field];

            // Sanitize based on field type
            switch ($field) {
                case 'handoff_score':
                    if (!is_numeric($value)) {
                        $skipped_fields[] = "$field (non-numeric)";
                        continue 2;
                    }
                    $value = floatval($value);
                    // Validate range 1-10
                    if ($value < 1 || $value > 10) {
                        $skipped_fields[] = "$field (out of range 1-10)";
                        continue 2;
                    }
                    break;
                case 'handoff_sources_count':
                    $value = intval($value);
                    break;
                case 'handoff_panel_complexity':
                case 'handoff_docs_quality':
                case 'handoff_learning_curve':
                case 'handoff_confidence':
                    $value = sanitize_text_field($value);
                    break;
                case 'handoff_recommendation':
                case 'handoff_verdict_safe':
                case 'handoff_verdict_caution':
                case 'handoff_verdict_avoid':
                    $value = sanitize_textarea_field($value);
                    break;
                case 'handoff_alternative_themes':
                    $value = sanitize_text_field($value);
                    break;
            }

            // Update field
            $field_result = update_field($field, $value, $theme_id);

            if ($field_result) {
                $imported_fields[] = $field;
            } else {
                // Even if update_field returns false (unchanged), we consider it processed if we had data
                // But for tracking "fresh" imports, we can log it. 
                // To be consistent with other functions, we'll count it as success if we tried to update it.
                $imported_fields[] = $field . ' (updated/unchanged)';
            }
        }
    }

    // Build status message
    $messages = [];
    if (!empty($imported_fields)) {
        $messages[] = "Imported: " . count($imported_fields) . " fields";
    }
    if (!empty($skipped_fields)) {
        $messages[] = "Skipped: " . implode(', ', $skipped_fields);
    }
    if (!empty($failed_fields)) {
        $messages[] = "Failed: " . implode(', ', $failed_fields);
    }

    $error_message = implode(' | ', $messages);

    return count($imported_fields) > 0;
}

/**
 * Import Community Pain Points data (MVP)
 */
function import_community_pain_points($theme_id, $data, &$error_message = '')
{
    // Check if ACF is active
    if (!function_exists('update_field')) {
        $error_message = 'ACF plugin not active or update_field function not available';
        return false;
    }

    // Check if post exists
    if (!get_post($theme_id)) {
        $error_message = 'Post with ID ' . $theme_id . ' does not exist';
        return false;
    }

    $success = true;
    $imported_fields = [];
    $skipped_fields = [];
    $failed_fields = [];

    // Import simple fields
    $simple_fields = [
        'community_total_discussions',
        'community_analysis_date',
        'community_timeframe',
        'community_methodology_note'
    ];

    foreach ($simple_fields as $field) {
        if (isset($data[$field])) {
            $value = $data[$field];

            // Sanitize based on field type
            switch ($field) {
                case 'community_total_discussions':
                    if (!is_numeric($value)) {
                        $skipped_fields[] = "$field (non-numeric)";
                        continue 2;
                    }
                    $value = intval($value);
                    break;
                case 'community_analysis_date':
                    $value = sanitize_text_field($value);
                    if (empty($value)) {
                        $skipped_fields[] = "$field (empty)";
                        continue 2;
                    }
                    break;
                case 'community_timeframe':
                case 'community_methodology_note':
                    $value = sanitize_textarea_field($value);
                    if (empty($value)) {
                        $skipped_fields[] = "$field (empty)";
                        continue 2;
                    }
                    break;
            }

            // Update field
            $field_result = update_field($field, $value, $theme_id);

            // update_field returns false if unchanged, but we consider it success if we had data to import
            if ($field_result || $field_result === false) {
                $imported_fields[] = $field;
            } else {
                $failed_fields[] = $field;
                $success = false;
            }
        }
    }

    // Import pain points repeater
    if (isset($data['community_pain_points']) && is_array($data['community_pain_points'])) {
        error_log('WPAgent Pain Points: Starting import of ' . count($data['community_pain_points']) . ' pain points');

        // Delete existing repeater data first using field KEY
        delete_field('field_community_pain_points', $theme_id);
        error_log('WPAgent Pain Points: Cleared existing community_pain_points');

        $imported_count = 0;

        foreach ($data['community_pain_points'] as $index => $point) {
            error_log("WPAgent Pain Points: Processing point #$index: " . print_r($point, true));

            $pain_point_item = [
                'category' => sanitize_text_field($point['category'] ?? ''),
                'sentiment' => sanitize_text_field($point['sentiment'] ?? ''),
                'source' => sanitize_text_field($point['source'] ?? ''),
                'source_url' => esc_url_raw($point['source_url'] ?? ''),
                'severity' => sanitize_text_field($point['severity'] ?? ''),
                'frequency' => sanitize_text_field($point['frequency'] ?? ''),
                'title' => sanitize_text_field($point['title'] ?? ''),
                'description' => sanitize_textarea_field($point['description'] ?? ''),
                'resolution' => sanitize_textarea_field($point['resolution'] ?? '')
            ];

            error_log("WPAgent Pain Points: Created row #$index: " . print_r($pain_point_item, true));

            // Add discussions sub-repeater
            if (isset($point['discussions']) && is_array($point['discussions'])) {
                $discussions = [];
                foreach ($point['discussions'] as $discussion) {
                    $discussions[] = [
                        'text' => sanitize_text_field($discussion['text'] ?? ''),
                        'url' => esc_url_raw($discussion['url'] ?? ''),
                        'votes' => sanitize_text_field($discussion['votes'] ?? '')
                    ];
                }
                $pain_point_item['discussions'] = $discussions;
                error_log("WPAgent Pain Points: Added " . count($discussions) . " discussions");
            }

            // Add row using field KEY
            $result = add_row('field_community_pain_points', $pain_point_item, $theme_id);

            error_log("WPAgent Pain Points: add_row result for #$index: " . ($result ? 'TRUE' : 'FALSE'));

            if ($result) {
                $imported_count++;
            }
        }

        error_log("WPAgent Pain Points: Import complete - added $imported_count of " . count($data['community_pain_points']) . " pain points");

        if ($imported_count > 0) {
            $imported_fields[] = 'community_pain_points (' . $imported_count . ' items)';

            // Verify the data was saved
            $saved_data = get_field('community_pain_points', $theme_id);
            error_log("WPAgent Pain Points: Verification - saved data count: " . (is_array($saved_data) ? count($saved_data) : 'NOT ARRAY'));
            if (is_array($saved_data) && !empty($saved_data)) {
                error_log("WPAgent Pain Points: First saved item: " . print_r($saved_data[0], true));
            }
        } else {
            $failed_fields[] = 'community_pain_points (no items added)';
            $success = false;
            error_log("WPAgent Pain Points: ERROR - No pain points were successfully imported");
        }
    } else {
        error_log("WPAgent Pain Points: community_pain_points not found in data or not an array");
    }

    // Import praise stats repeater
    if (isset($data['community_praise_stats']) && is_array($data['community_praise_stats'])) {
        // Delete existing repeater data first using field KEY
        delete_field('field_community_praise_stats', $theme_id);

        $praise_imported_count = 0;

        foreach ($data['community_praise_stats'] as $stat) {
            // Support both 'text' and 'praise_text', 'percentage' and 'praise_percentage'
            $row = [
                'percentage' => intval($stat['percentage'] ?? $stat['praise_percentage'] ?? 0),
                'text' => sanitize_text_field($stat['text'] ?? $stat['praise_text'] ?? '')
            ];

            // Add row using field KEY only if text is provided
            if (!empty($row['text'])) {
                if (add_row('field_community_praise_stats', $row, $theme_id)) {
                    $praise_imported_count++;
                }
            }
        }

        if ($praise_imported_count > 0) {
            $imported_fields[] = 'community_praise_stats (' . $praise_imported_count . ' items)';
        } else {
            // Optional: Log if empty but array existed
        }
    }

    // Build status message
    $messages = [];
    if (!empty($imported_fields)) {
        $messages[] = "Imported: " . implode(', ', $imported_fields);
    }
    if (!empty($skipped_fields)) {
        $messages[] = "Skipped: " . implode(', ', $skipped_fields);
    }
    if (!empty($failed_fields)) {
        $messages[] = "Failed: " . implode(', ', $failed_fields);
    }

    $error_message = implode(' | ', $messages);

    return $success;
}

/**
 * Import Plugin Compatibility Enhanced data (MVP)
 */
function import_plugin_compatibility_enhanced($theme_id, $data, &$error_message = '')
{
    // Check if ACF is active
    if (!function_exists('update_field')) {
        $error_message = 'ACF plugin not active or update_field function not available';
        return false;
    }

    // Check if post exists
    if (!get_post($theme_id)) {
        $error_message = 'Post with ID ' . $theme_id . ' does not exist';
        return false;
    }

    $success = true;
    $imported_fields = [];
    $skipped_fields = [];
    $failed_fields = [];

    // Import summary statistics
    $summary_fields = [
        'compat_total_tested',
        'compat_full_compatible',
        'compat_issues_found'
    ];

    foreach ($summary_fields as $field) {
        if (isset($data[$field])) {
            // Delete existing field first to avoid conflicts on re-import
            delete_field($field, $theme_id);

            $value = intval($data[$field]);

            $field_result = update_field($field, $value, $theme_id);

            if ($field_result) {
                $imported_fields[] = $field;
            } else {
                $failed_fields[] = $field;
                $success = false;
            }
        }
    }

    // Import verdict and recommendation fields
    $verdict_fields = [
        'compat_confidence',
        'compat_sources_count',
        'compat_verdict_safe',
        'compat_verdict_caution',
        'compat_verdict_avoid',
        'compat_recommendation',
        'compat_alternative_themes'
    ];

    foreach ($verdict_fields as $field) {
        if (isset($data[$field])) {
            $value = $data[$field];
            if (strpos($field, 'verdict') !== false || $field === 'compat_recommendation') {
                $value = sanitize_textarea_field($value);
            } elseif ($field === 'compat_sources_count') {
                $value = intval($value);
            } else {
                $value = sanitize_text_field($value);
            }

            $field_result = update_field($field, $value, $theme_id);
            if ($field_result) {
                $imported_fields[] = $field;
            }
        }
    }

    // Import plugin compatibility list
    if (isset($data['plugin_compatibility_list']) && is_array($data['plugin_compatibility_list'])) {
        error_log('WPAgent Plugin Compat: Starting import of ' . count($data['plugin_compatibility_list']) . ' plugins');

        // IMPORTANT: Delete existing repeater field data first using field KEY
        delete_field('field_plugin_compatibility_list', $theme_id);
        error_log('WPAgent Plugin Compat: Cleared existing plugin_compatibility_list');

        $imported_count = 0;
        $all_rows = [];

        foreach ($data['plugin_compatibility_list'] as $index => $plugin) {
            error_log("WPAgent Plugin Compat: Processing plugin #$index: " . print_r($plugin, true));

            // Get or create plugin taxonomy term
            $plugin_name = sanitize_text_field($plugin['plugin'] ?? '');
            $plugin_term_id = null;

            if (!empty($plugin_name)) {
                error_log("WPAgent Plugin Compat: Plugin name: $plugin_name");

                // Try to find existing term in plugin-compatible taxonomy
                $existing_term = get_term_by('name', $plugin_name, 'plugin-compatible');

                if ($existing_term) {
                    $plugin_term_id = intval($existing_term->term_id);
                    error_log("WPAgent Plugin Compat: Found existing term ID: $plugin_term_id for '$plugin_name'");
                } else {
                    // Create new term in plugin-compatible taxonomy
                    $new_term = wp_insert_term($plugin_name, 'plugin-compatible');
                    if (!is_wp_error($new_term)) {
                        $plugin_term_id = intval($new_term['term_id']);
                        error_log("WPAgent Plugin Compat: Created new term ID: $plugin_term_id for '$plugin_name'");
                    } else {
                        error_log("WPAgent Plugin Compat: ERROR creating term for '$plugin_name': " . $new_term->get_error_message());
                    }
                }
            } else {
                error_log("WPAgent Plugin Compat: ERROR - empty plugin name at index $index");
            }

            // Skip if plugin term not found/created
            if (!$plugin_term_id) {
                $skipped_fields[] = "Plugin '{$plugin_name}' - could not create/find term";
                error_log("WPAgent Plugin Compat: SKIPPING plugin '$plugin_name' - no term ID");
                continue;
            }

            // Build row data for ACF repeater using field KEYS to guarantee mapping
            $row = [
                'field_plugin_name' => $plugin_term_id,
                'field_plugin_category_compat' => sanitize_text_field($plugin['plugin_category'] ?? ''),
                'field_plugin_compat_status' => sanitize_text_field($plugin['compatibility_status'] ?? ''),
                'field_plugin_compat_notes' => sanitize_textarea_field($plugin['compatibility_notes'] ?? '')
            ];

            // Add user issues sub-repeater if present
            if (isset($plugin['user_issues']) && is_array($plugin['user_issues'])) {
                $issues = [];
                // Map user_issues using field keys
                foreach ($plugin['user_issues'] as $issue) {
                    if (is_array($issue)) {
                        $issue_item = [
                            'field_issue_severity' => sanitize_text_field($issue['severity'] ?? ''),
                            'field_issue_title' => sanitize_text_field($issue['title'] ?? ''),
                            'field_issue_description' => sanitize_textarea_field($issue['description'] ?? ''),
                            'field_issue_resolution' => sanitize_textarea_field($issue['resolution'] ?? '')
                        ];

                        // Add sources sub-repeater
                        if (isset($issue['sources']) && is_array($issue['sources'])) {
                            $sources = [];
                            foreach ($issue['sources'] as $source) {
                                $sources[] = [
                                    'field_source_type' => sanitize_text_field($source['type'] ?? ''),
                                    'field_source_url' => esc_url_raw($source['url'] ?? ''),
                                    'field_source_metric' => sanitize_text_field($source['metric'] ?? '')
                                ];
                            }
                            $issue_item['field_issue_sources'] = $sources;
                        }
                        $issues[] = $issue_item;
                    }
                }
                $row['field_plugin_user_issues'] = $issues;
                error_log("WPAgent Plugin Compat: Added " . count($issues) . " user issues");
            }

            $all_rows[] = $row;
            $imported_count++;
            error_log("WPAgent Plugin Compat: Successfully prepared row #$index for '$plugin_name'");
        }

        // Use update_field with the complete array of rows instead of add_row repeatedly
        if (!empty($all_rows)) {
            $result = update_field('field_plugin_compatibility_list', $all_rows, $theme_id);
            if ($result) {
                error_log("WPAgent Plugin Compat: Successfully updated field_plugin_compatibility_list with $imported_count rows");
            } else {
                error_log("WPAgent Plugin Compat: Failed to update field_plugin_compatibility_list");
            }
        }

        error_log("WPAgent Plugin Compat: Import complete - added $imported_count of " . count($data['plugin_compatibility_list']) . " plugins");

        if ($imported_count > 0) {
            $imported_fields[] = 'plugin_compatibility_list (' . $imported_count . ' plugins)';

            // Verify the data was saved
            $saved_data = get_field('plugin_compatibility_list', $theme_id);
            error_log("WPAgent Plugin Compat: Verification - saved data count: " . (is_array($saved_data) ? count($saved_data) : 'NOT ARRAY'));
            if (is_array($saved_data) && !empty($saved_data)) {
                error_log("WPAgent Plugin Compat: First saved item: " . print_r($saved_data[0], true));
            }
        } else {
            error_log("WPAgent Plugin Compat: ERROR - No plugins were successfully imported");
        }
    } else {
        error_log("WPAgent Plugin Compat: plugin_compatibility_list not found in data or not an array");
    }

    // Build status message
    $messages = [];
    if (!empty($imported_fields)) {
        $messages[] = "Imported: " . implode(', ', $imported_fields);
    }
    if (!empty($skipped_fields)) {
        $messages[] = "Skipped: " . implode(', ', $skipped_fields);
    }
    if (!empty($failed_fields)) {
        $messages[] = "Failed: " . implode(', ', $failed_fields);
    }

    $error_message = implode(' | ', $messages);

    return true; // Always return true if we reached here without exception
}


// NEW IMPORT FUNCTIONS - All 14 ACF Groups Support

function import_quick_overview($theme_id, $data)
{
    if (!function_exists('update_field'))
        return false;
    $fields = ['quick_verdict', 'quick_pros', 'quick_cons'];
    $processed = 0;
    foreach ($fields as $field) {
        if (isset($data[$field])) {
            update_field($field, $data[$field], $theme_id);
            $processed++;
        }
    }
    return $processed > 0;
}

function import_theme_basic($theme_id, $data)
{
    if (!function_exists('update_field')) {
        error_log("ACF update_field function missing");
        return false;
    }

    error_log("Importing theme_basic for $theme_id. Data keys: " . implode(',', array_keys($data)));

    $field_map = ['theme_author' => 'text', 'theme_version' => 'text', 'release_date' => 'date', 'last_update' => 'date', 'code_quality' => 'select', 'theme_tagline' => 'text', 'sales_count' => 'text', 'demo_url' => 'url', 'affiliate_url' => 'url'];
    $processed = 0;

    foreach ($field_map as $field => $type) {
        if (isset($data[$field])) {
            $value = ($type === 'url') ? esc_url_raw($data[$field]) : sanitize_text_field($data[$field]);

            // Try updating by field name
            $updated = update_field($field, $value, $theme_id);

            error_log("Field '$field' update result: " . ($updated ? 'true' : 'false') . " Value: " . substr(print_r($value, true), 0, 50));

            // Count as processed if data existed
            $processed++;
        } else {
            error_log("Field '$field' missing in input data");
        }
    }

    error_log("Processed fields: $processed");
    return $processed > 0;
}

function import_scenario_performance($theme_id, $data)
{
    if (!function_exists('update_field'))
        return false;
    $fields = ['perf_confidence', 'perf_sources_count', 'perf_verdict_safe', 'perf_verdict_caution', 'perf_verdict_avoid', 'perf_code_observation', 'perf_recommendation', 'perf_alternative_themes'];
    $processed = 0;
    foreach ($fields as $field) {
        if (isset($data[$field])) {
            if (strpos($field, 'verdict') !== false || $field === 'perf_recommendation' || $field === 'perf_code_observation') {
                $value = sanitize_textarea_field($data[$field]);
            } elseif ($field === 'perf_sources_count') {
                $value = intval($data[$field]);
            } else {
                $value = sanitize_text_field($data[$field]);
            }
            update_field($field, $value, $theme_id);
            $processed++;
        }
    }
    return $processed > 0;
}

function import_scenario_updates($theme_id, $data)
{
    if (!function_exists('update_field'))
        return false;
    $fields = ['updates_confidence', 'updates_sources_count', 'updates_verdict_safe', 'updates_verdict_caution', 'updates_verdict_avoid', 'updates_recommendation', 'updates_alternative_themes'];
    $processed = 0;
    foreach ($fields as $field) {
        if (isset($data[$field])) {
            if (strpos($field, 'verdict') !== false || $field === 'updates_recommendation') {
                $value = sanitize_textarea_field($data[$field]);
            } elseif ($field === 'updates_sources_count') {
                $value = intval($data[$field]);
            } else {
                $value = sanitize_text_field($data[$field]);
            }
            update_field($field, $value, $theme_id);
            $processed++;
        }
    }
    return $processed > 0;
}

function import_scenario_scalability($theme_id, $data)
{
    if (!function_exists('update_field'))
        return false;
    $fields = ['scale_confidence', 'scale_sources_count', 'scale_verdict_safe', 'scale_verdict_caution', 'scale_verdict_avoid', 'scale_recommendation', 'scale_alternative_themes'];
    $processed = 0;
    foreach ($fields as $field) {
        if (isset($data[$field])) {
            if (strpos($field, 'verdict') !== false || $field === 'scale_recommendation') {
                $value = sanitize_textarea_field($data[$field]);
            } elseif ($field === 'scale_sources_count') {
                $value = intval($data[$field]);
            } else {
                $value = sanitize_text_field($data[$field]);
            }
            update_field($field, $value, $theme_id);
            $processed++;
        }
    }
    return $processed > 0;
}

function import_theme_pricing($theme_id, $data)
{
    if (!function_exists('update_field'))
        return false;
    $simple_fields = ['license_type', 'pricing_model', 'base_price', 'support_period_included', 'support_renewal_cost', 'update_policy', 'money_back_guarantee'];
    $processed = 0;
    foreach ($simple_fields as $field) {
        if (isset($data[$field])) {
            $value = in_array($field, ['base_price', 'support_period_included', 'support_renewal_cost']) ? floatval($data[$field]) : sanitize_text_field($data[$field]);
            update_field($field, $value, $theme_id);
            $processed++;
        }
    }
    if (isset($data['pricing_tiers']) && is_array($data['pricing_tiers'])) {
        $tiers = [];
        foreach ($data['pricing_tiers'] as $tier) {
            $tiers[] = ['tier_name' => sanitize_text_field($tier['tier_name'] ?? ''), 'tier_price' => floatval($tier['tier_price'] ?? 0), 'tier_type' => sanitize_text_field($tier['tier_type'] ?? ''), 'tier_description' => sanitize_textarea_field($tier['tier_description'] ?? '')];
        }
        update_field('pricing_tiers', $tiers, $theme_id);
        $processed++;
    }
    return $processed > 0;
}

function import_theme_ratings($theme_id, $data)
{
    if (!function_exists('update_field')) {
        error_log('WPAgent Ratings: ACF update_field function not available');
        return false;
    }

    $processed = 0;

    // Import popularity_trend
    if (isset($data['popularity_trend'])) {
        $value = sanitize_text_field($data['popularity_trend']);
        $result = update_field('popularity_trend', $value, $theme_id);
        error_log("WPAgent Ratings: popularity_trend = '$value', result: " . ($result ? 'TRUE' : 'FALSE'));
        if ($result) {
            $processed++;
        }
    }

    // Import external_ratings repeater
    if (isset($data['external_ratings']) && is_array($data['external_ratings'])) {
        error_log('WPAgent Ratings: Starting import of ' . count($data['external_ratings']) . ' external ratings');

        // Clear existing repeater data first using field KEY
        delete_field('field_external_ratings', $theme_id);
        error_log('WPAgent Ratings: Cleared existing external_ratings');

        $imported_count = 0;

        foreach ($data['external_ratings'] as $index => $rating) {
            error_log("WPAgent Ratings: Processing rating #$index: " . print_r($rating, true));

            // Build row data with sanitization
            $row = [
                'rating_source' => sanitize_text_field($rating['rating_source'] ?? ''),
                'rating_score' => floatval($rating['rating_score'] ?? 0),
                'rating_count' => intval($rating['rating_count'] ?? 0),
                'rating_url' => esc_url_raw($rating['rating_url'] ?? '')
            ];

            error_log("WPAgent Ratings: Created row #$index: " . print_r($row, true));

            // Add row using field KEY
            $result = add_row('field_external_ratings', $row, $theme_id);

            error_log("WPAgent Ratings: add_row result for #$index: " . ($result ? 'TRUE' : 'FALSE'));

            if ($result) {
                $imported_count++;
            }
        }

        error_log("WPAgent Ratings: Import complete - added $imported_count of " . count($data['external_ratings']) . " ratings");

        if ($imported_count > 0) {
            $processed++;

            // Verify the data was saved
            $saved_data = get_field('external_ratings', $theme_id);
            error_log("WPAgent Ratings: Verification - saved data count: " . (is_array($saved_data) ? count($saved_data) : 'NOT ARRAY'));
            if (is_array($saved_data) && !empty($saved_data)) {
                error_log("WPAgent Ratings: First saved item: " . print_r($saved_data[0], true));
            }
        } else {
            error_log("WPAgent Ratings: ERROR - No ratings were successfully imported");
        }
    }

    return $processed > 0;
}

function import_theme_technical($theme_id, $data)
{
    if (!function_exists('update_field'))
        return false;
    $fields = ['min_wp_version', 'min_php_version', 'wp_compatibility', 'last_verification', 'activity_status'];
    $processed = 0;
    foreach ($fields as $field) {
        if (isset($data[$field])) {
            $value = sanitize_text_field($data[$field]);
            update_field($field, $value, $theme_id);
            $processed++;
        }
    }
    return $processed > 0;
}

function import_sources_methodology($theme_id, $data)
{
    if (!function_exists('update_field') || !function_exists('add_row') || !function_exists('delete_field'))
        return false;

    $processed = 0;

    // Simple fields mapping (data_key => field_key)
    $fields = [
        'methodology_note' => 'field_methodology_note',
        'analysis_date' => 'field_sources_analysis_date',
        'data_timeframe' => 'field_data_timeframe',
        'confidence_statement' => 'field_confidence_statement'
    ];

    foreach ($fields as $data_key => $field_key) {
        if (isset($data[$data_key])) {
            $value = $data_key === 'analysis_date' ? sanitize_text_field($data[$data_key]) : sanitize_textarea_field($data[$data_key]);
            update_field($field_key, $value, $theme_id);
            $processed++;
        }
    }

    // Sources repeater - Use delete_field + add_row
    // IMPORTANT: add_row expects sub-field NAMES as keys, not field keys
    if (isset($data['sources']) && is_array($data['sources'])) {
        // Clear existing rows first using the field key
        delete_field('field_sources_list', $theme_id);

        foreach ($data['sources'] as $source) {
            // ACF shortens sub-field names: 'url' not 'source_url', 'type' not 'source_type'
            $row = [
                'source_id' => sanitize_text_field($source['source_id'] ?? ''),
                'source_name' => sanitize_text_field($source['source_name'] ?? ''),
                'source_url' => esc_url_raw($source['source_url'] ?? ''),
                'source_type' => sanitize_text_field($source['source_type'] ?? '')
            ];

            // Add row using the repeater field key
            add_row('field_sources_list', $row, $theme_id);
        }
        $processed++;
    }

    return $processed > 0;
}

function import_faq($theme_id, $data)
{
    if (!function_exists('update_field'))
        return false;

    $processed = 0;

    // Import generation note
    if (isset($data['faq_generation_note'])) {
        update_field('faq_generation_note', sanitize_text_field($data['faq_generation_note']), $theme_id);
        $processed++;
    }

    // Import FAQ items
    if (isset($data['faq_items']) && is_array($data['faq_items'])) {
        $faq_items = [];

        foreach ($data['faq_items'] as $item) {
            if (empty($item['faq_question']) || empty($item['faq_answer'])) {
                continue; // Skip invalid items
            }

            $faq_items[] = [
                'faq_question' => sanitize_text_field($item['faq_question']),
                'faq_answer' => sanitize_textarea_field($item['faq_answer']),
                'faq_category' => sanitize_text_field($item['faq_category'] ?? 'general'),
                'faq_source_ids' => sanitize_text_field($item['faq_source_ids'] ?? '')
            ];
        }

        if (!empty($faq_items)) {
            update_field('faq_items', $faq_items, $theme_id);
            $processed++;

            // Auto-set faq_display to true when items exist
            update_field('faq_display', true, $theme_id);
        } else {
            // No valid items - set display to false
            update_field('faq_display', false, $theme_id);
        }
    }

    return $processed > 0;
}

function import_human_summary($theme_id, $data)
{
    if (!isset($data['summary_paragraphs']) || !is_array($data['summary_paragraphs'])) {
        return false;
    }

    // Convert array of paragraphs to Gutenberg blocks
    $gutenberg_content = '';
    foreach ($data['summary_paragraphs'] as $paragraph) {
        if (!empty($paragraph)) {
            // Check if paragraph already contains Gutenberg blocks
            if (strpos($paragraph, '<!-- wp:') !== false) {
                // Already a Gutenberg block, use as-is
                $gutenberg_content .= $paragraph . "\n\n";
            } else {
                // Convert plain text to Gutenberg paragraph block
                $sanitized = wp_kses_post($paragraph);
                $gutenberg_content .= "<!-- wp:paragraph -->\n";
                $gutenberg_content .= "<p>" . $sanitized . "</p>\n";
                $gutenberg_content .= "<!-- /wp:paragraph -->\n\n";
            }
        }
    }

    // Update post content
    if (!empty($gutenberg_content)) {
        $result = wp_update_post([
            'ID' => $theme_id,
            'post_content' => $gutenberg_content
        ]);

        return $result && !is_wp_error($result);
    }

    return false;
}

/**
 * Handle bulk import of all sections at once
 * 
 * @param int $theme_id Post ID of the theme profile
 * @param array $data Array with section keys and their respective data
 * @return array Results for each imported section
 */
function wpagent_handle_bulk_import($theme_id, $data)
{
    $results = [];
    $errors = [];

    // Map of section keys to import function names
    $section_map = [
        'human_summary' => 'import_human_summary',
        'quick_overview' => 'import_quick_overview',
        'theme_basic' => 'import_theme_basic',
        'performance_metrics' => 'import_performance_metrics',
        'demo_gallery' => 'import_demo_gallery',
        'sources_methodology' => 'import_sources_methodology',
        'handoff_difficulty' => 'import_handoff_difficulty',
        'scenario_performance' => 'import_scenario_performance',
        'scenario_updates' => 'import_scenario_updates',
        'scenario_scalability' => 'import_scenario_scalability',
        'theme_pricing' => 'import_theme_pricing',
        'theme_ratings' => 'import_theme_ratings',
        'theme_technical' => 'import_theme_technical',
        'community_pain_points' => 'import_community_pain_points',
        'faq' => 'import_faq',
        'plugin_compatibility_enhanced' => 'import_plugin_compatibility_enhanced',
        'bundled_plugins' => 'import_bundled_plugins',
        'search_profile' => 'import_search_profile'
    ];

    foreach ($section_map as $section_key => $import_function) {
        if (isset($data[$section_key])) {
            if (function_exists($import_function)) {
                try {
                    // Special handling for demo_gallery which expects an error message parameter
                    if ($section_key === 'demo_gallery') {
                        $error_msg = '';
                        $success = $import_function($theme_id, $data[$section_key], $error_msg);
                        if ($error_msg) {
                            $errors[$section_key] = $error_msg;
                        }
                        $results[$section_key] = $success;
                    } else {
                        $success = $import_function($theme_id, $data[$section_key]);
                        $results[$section_key] = $success;
                    }
                } catch (Exception $e) {
                    $errors[$section_key] = $e->getMessage();
                    $results[$section_key] = false;
                }
            } else {
                $errors[$section_key] = "Import function '{$import_function}' not found";
                $results[$section_key] = false;
            }
        }
    }

    // Log results for debugging
    error_log('Bulk import results: ' . print_r($results, true));
    if (!empty($errors)) {
        error_log('Bulk import errors: ' . print_r($errors, true));
    }

    // Return true if at least one section was imported successfully
    return in_array(true, $results, true);
}

function import_search_profile($theme_id, $data)
{
    if (!function_exists('update_field'))
        return false;

    // Handle both array wrapper (direct import) and string (bulk import)
    $value = '';
    if (is_array($data) && isset($data['search_profile'])) {
        $value = $data['search_profile'];
    } elseif (is_string($data)) {
        $value = $data;
    }

    if (!empty($value)) {
        update_field('search_profile', sanitize_text_field($value), $theme_id);
        return true;
    }

    return false;
}
