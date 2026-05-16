/**
 * WPAgent Theme Processor v3.20.3
 * 3-Step Pipeline with Deep Source Reference Walker + Distribution Model + Search Profile
 *
 * CHANGELOG:
 * v3.20.3: Stale-aware cleanup hardening
 *          - FIX 1: plugin_compatibility_list degraded to "previously_reported" when all refs are stale
 *          - FIX 2: severity floor — stale moderate → minor
 *          - FIX 3: warnings for empty resolution / summary_recommendation
 *          - FIX 4: quick_cons stale reference warning
 *
 * v3.20.2: Cleanup logic fixes — source_date inference, version_reported from changelog, category validation
 *          - source_date backfilled from pain point/praise date_reported (FIX 1)
 *          - parseChangelogVersions() + version_reported inference from date (FIX 2)
 *          - VALID_PAIN_CATEGORIES enum validation + mapping (FIX 3)
 *          - Strip "(inferred from date)" suffix in stale detection (FIX 4)
 *
 * v3.20.1: Post-Kadence QA fixes
 *          - source_date ENFORCEMENT rule 21, date-unknown paragraph (WordPress/Reddit fix)
 *          - scope mis-assignment fix (Starter Templates → ECOSYSTEM), severity calibration
 *          - VERSION EXTRACTION PRIORITY block, community_timeframe → "Last 6 months"
 *          - cleanupOutput: compat_sources_count auto-fix from citations
 *
 * v3.20.0: Scope tagging + Date enforcement + Severity calibration + Changelog input
 *          - COL.CHANGELOG (col K), buildStep1/2Prompt rewrite, schema +scope/date_reported/source_date
 *          - cleanupOutput: scope defaults + date-based stale detection, STALE_DATE_MONTHS
 *
 * v3.19.8: Text-scan hardening (Bricks Builder false positives):
 *          - generateSearchProfile() layer 0 (NEW): theme IS a builder detection.
 *            If theme name/author matches builder keyword → tag as full (no suffix).
 *            Bricks Builder → "bricks", Divi → "divi", Hello Elementor → "elementor"
 *          - generateSearchProfile() layer 3: guard (a) — skip text-scan if theme IS builder
 *          - generateSearchProfile() layer 3: guard (b) — skip if not in compat_list
 *          - mapBuilderTags(): same layer 0 logic for taxonomy assignment
 *            (Bricks now gets page_builders: [1115] instead of empty)
 *          Praise extraction overhaul (Gemini consistently output 1/12 praise-to-pain ratio):
 *          - buildStep1Prompt(): Expanded praise section from 2 to 20 lines — categories,
 *            extraction guide, WHERE to look, HARD minimum 3 with enforcement
 *          - buildStep2Prompt(): Replaced weak "PRAISE FALLBACK RULE" with explicit
 *            "PRAISE EXTRACTION (CRITICAL)" — preserve Step 1 praise, supplement if < 3
 *          - buildStep3Prompt(): Rule 17 + full praise schema in getJsonSchema()
 *            (was empty array — Gemini had no guidance on praise structure)
 *          - generateFallbackPraise(): Added performance-based and code-quality-based
 *            fallback praise (Bricks: excellent perf + high code = 2 extra fallbacks)
 *          - cleanupOutput() step 3: Changed fallback trigger from "empty" to "< 3" —
 *            supplements Gemini output with non-duplicate category fallbacks
 *          - cleanupOutput() step 1b: strip prefixes < <= > >= ~ ^ from
 *            version_reported before parsing (Gemini outputs "< 2.0" etc.)
 *          - Root cause: "< 2.0" failed semver parse → treated as unknown →
 *            critical SQL injection pain point not flagged stale →
 *            false security:critical-historical tag in search_profile
 *
 * v3.19.7: Stale pain point detection
 * v3.19.6: Pain point cross-reference rule
 * v3.19.5: Companion plugin filter
 * v3.19.4: generateSearchProfile() bugfixes
 * v3.19.3: Builder tag compatibility suffix
 * v3.19.2: Security flag + ideal/avoid fix
 * v3.19.1: Taxonomy slug fixes
 * v3.19.0: search_profile generation
 * v3.18.3: Companion plugin filter, generic URL detection
 * v3.18:   Distribution Model Fix
 * v3.17:   Deep Source Reference Walker
 */

// ============================================
// CONFIGURATION
// ============================================

var GEMINI_API_KEY = 'REDACTED';
var GEMINI_MODEL = 'gemini-2.5-pro';
var OUTPUT_FOLDER = 'WPAgent_Outputs';

var WP_API_URL = 'https://themescout.pro/wp-json';
var WP_API_TOKEN = Utilities.base64Encode('REDACTED:REDACTED');

var COL = {
    THEME_NAME:   1,
    SCRAPED_JSON: 2,
    PERPLEXITY:   3,
    STEP1_OUTPUT: 4,
    STEP2_OUTPUT: 5,
    STEP3_OUTPUT: 6,
    STATUS:       7,
    OUTPUT_LINK:  8,
    DEBUG_RAW:    9,
    CHANGELOG:   11
};

var COL_TAXONOMY = 10;
var COL_WP_POST_ID = 12;

var CLEANUP_CONFIG = {
    MIN_SOURCES_FOR_FAQ:    5,
    MIN_VERDICT_LENGTH:     20,
    INVALID_URL_PATTERNS:   ['unknown', 'n/a', 'none', 'null', ''],
    INVALID_PLUGIN_STATUSES:['untested', 'unknown'],
    SHORT_VERDICT_WORDS:    ['safe', 'caution', 'avoid', 'recommended', 'not recommended', 'yes', 'no'],
    MIN_PAIN_POINTS:        8
};

var NON_ANALYTICAL_SOURCE_TYPES = ['demo_site', 'test_site', 'performance_report', 'other'];

var STALE_DATE_MONTHS = 6;

function isGenericUrl(url) {
    if (!url) return true;
    try {
        var u = url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
        var parts = u.split('/');
        if (parts.length <= 1) return true;
        if (parts.length <= 3 && /reddit\.com\/r\/[^\/]+\/?$/i.test(url)) return true;
        return false;
    } catch (e) { return true; }
}

var PAGESPEED_THRESHOLDS = {
    EXCELLENT:  90,
    GOOD:       70,
    NEEDS_WORK: 50,
    LCP_GOOD:   2.5,
    LCP_POOR:   4.0,
    CLS_GOOD:   0.1,
    CLS_POOR:   0.25
};

var HANDOFF_WEIGHTS = {
    panel_complexity: { minimal: 0, moderate: 1, complex: 2, overwhelming: 3 },
    docs_quality:     { excellent: 0, good: 1, basic: 2, poor: 3 },
    learning_curve:   { minutes: 0, hours: 1, days: 2, weeks: 3 }
};

// ============================================
// MENU
// ============================================

function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('🚀 WPAgent')
        .addItem('▶ Step 1: Community Analysis',  'runStep1')
        .addItem('▶ Step 2: Verdict Synthesis',   'runStep2')
        .addItem('▶ Step 3: JSON Formatter',      'runStep3')
        .addSeparator()
        .addItem('⚡ Run All Steps',              'runAllSteps')
        .addSeparator()
        .addItem('🧹 Re-run Cleanup Only',        'rerunCleanup')
        .addItem('✓ Validate Output',             'validateOutput')
        .addItem('💾 Save JSON to Drive',         'saveOutputToDrive')
        .addSeparator()
        .addItem('🔧 Test API Connection',        'testConnection')
        .addSeparator()
        .addItem('🏷️ Assign Taxonomies',          'assignTaxonomies')
        .addItem('🔎 Validate All Themes',        'validateAllThemes')
        .addItem('📋 Prepare Review Dashboard',   'prepareReviewDashboard')
        .addItem('📊 Review Summary',             'reviewSummary')
        .addSeparator()
        .addItem('📤 Import to WP',               'importToWP')
        .addItem('📤 Import All to WP',           'importAllToWP')
        .addItem('🔗 Fetch WP Post IDs', 'fetchPostIDs')
        .addToUi();
}

// ============================================
// DISTRIBUTION MODEL HELPERS (v3.18)
// ============================================

function getDistributionModel(scrapedJson) {
    if (!scrapedJson) return 'themeforest';
    try {
        var parsed = typeof scrapedJson === 'string' ? JSON.parse(scrapedJson) : scrapedJson;
        var m = (parsed.distribution_model || (parsed._meta && parsed._meta.distribution_model) || '').toLowerCase().trim();
        if (['wordpress_org', 'direct_sale', 'themeforest'].indexOf(m) !== -1) return m;
        var src = ((parsed.marketplace_data && parsed.marketplace_data.source) || '').toLowerCase();
        if (src.indexOf('wordpress.org') !== -1) return 'wordpress_org';
        if (src.indexOf('themeforest') !== -1 || src.indexOf('envato') !== -1) return 'themeforest';
        var srcUrl = ((parsed.marketplace_data && parsed.marketplace_data.source_url) || '').toLowerCase();
        if (srcUrl.indexOf('wordpress.org') !== -1) return 'wordpress_org';
        if (srcUrl.indexOf('themeforest.net') !== -1) return 'themeforest';
        var knownMarketplaces = ['themeforest.net', 'wordpress.org', 'envato.com', 'codecanyon.net', 'creativemarket.com'];
        var isMarketplace = false;
        for (var i = 0; i < knownMarketplaces.length; i++) {
            if (srcUrl.indexOf(knownMarketplaces[i]) !== -1) { isMarketplace = true; break; }
        }
        if (srcUrl && srcUrl.indexOf('http') !== -1 && !isMarketplace) return 'direct_sale';
        var salesCount = ((parsed.marketplace_data && parsed.marketplace_data.sales_count) || '').toLowerCase();
        if (salesCount.indexOf('direct') !== -1 || salesCount === 'n/a') return 'direct_sale';
    } catch (e) {}
    return 'themeforest';
}

function getDistributionModelInstructions(model) {
    var m = (model || 'themeforest').toLowerCase().trim();
    if (m === 'wordpress_org') {
        return '## DISTRIBUTION MODEL: WordPress.org (Freemium)\n' +
            'This theme is distributed via WordPress.org repository (free version) + author website (Pro).\n' +
            'MANDATORY RULES:\n' +
            '- Primary data source: wordpress.org/themes/ (active installs, rating, reviews)\n' +
            '- Pro pricing/features: from author official website ONLY\n' +
            '- DO NOT reference ThemeForest — this theme is NOT sold there\n' +
            '- DO NOT attribute any data to ThemeForest or Envato marketplace\n' +
            '- "sales_count" field = WordPress.org active installs (label as such)\n' +
            '- external_ratings source = "WordPress.org" (not ThemeForest)\n' +
            '- If you find ThemeForest URLs in scraped data, IGNORE them — they are errors\n\n';
    }
    if (m === 'direct_sale') {
        return '## DISTRIBUTION MODEL: Direct Sale\n' +
            'This theme is sold exclusively through the author\'s website.\n' +
            'MANDATORY RULES:\n' +
            '- Primary data source: author official website\n' +
            '- DO NOT reference ThemeForest — this theme is NOT sold there\n' +
            '- DO NOT reference WordPress.org repository (unless free version exists)\n' +
            '- DO NOT attribute any data to ThemeForest or Envato marketplace\n' +
            '- "sales_count" = use author-reported numbers or "N/A"\n' +
            '- external_ratings: use Trustpilot, G2, or similar — NOT ThemeForest\n\n';
    }
    return '## DISTRIBUTION MODEL: ThemeForest\n' +
        'This theme is sold on ThemeForest (Envato Market).\n' +
        'RULES:\n' +
        '- Primary marketplace source: ThemeForest\n' +
        '- "sales_count" = ThemeForest total sales\n' +
        '- external_ratings: ThemeForest rating is primary\n\n';
}

// ============================================
// HANDOFF SCORE CALCULATION
// ============================================

function calculateHandoffScore(panelComplexity, docsQuality, learningCurve) {
    var panel = HANDOFF_WEIGHTS.panel_complexity[panelComplexity];
    var docs  = HANDOFF_WEIGHTS.docs_quality[docsQuality];
    var curve = HANDOFF_WEIGHTS.learning_curve[learningCurve];
    if (panel === undefined) panel = 2;
    if (docs  === undefined) docs  = 2;
    if (curve === undefined) curve = 2;
    return Math.max(1, Math.min(10, 10 - (panel + docs + curve)));
}

function fixHandoffScore(data) {
    var result = { data: data, changed: false, oldScore: 0, newScore: 0 };
    if (!data.handoff_difficulty) return result;
    var h = data.handoff_difficulty;
    var oldScore = h.handoff_score || 0;
    var newScore = calculateHandoffScore(h.handoff_panel_complexity, h.handoff_docs_quality, h.handoff_learning_curve);
    if (oldScore !== newScore) {
        result.oldScore = oldScore;
        result.newScore = newScore;
        result.changed  = true;
        data.handoff_difficulty.handoff_score = newScore;
    }
    return result;
}

// ============================================
// PAGESPEED HELPERS
// ============================================

function getPerformanceTier(mobileScore) {
    if (!mobileScore || mobileScore <= 0) return '';
    if (mobileScore >= PAGESPEED_THRESHOLDS.EXCELLENT)  return 'excellent';
    if (mobileScore >= PAGESPEED_THRESHOLDS.GOOD)       return 'good';
    if (mobileScore >= PAGESPEED_THRESHOLDS.NEEDS_WORK) return 'needs_work';
    return 'poor';
}

function generatePerformanceInterpretation(mobileScore, lcpMobile, clsMobile) {
    if (!mobileScore || mobileScore <= 0) return 'No PageSpeed data available.';
    var interp = 'Mobile PageSpeed ' + mobileScore + '/100. ';
    if      (mobileScore >= PAGESPEED_THRESHOLDS.EXCELLENT)  interp += 'Excellent performance suitable for demanding projects.';
    else if (mobileScore >= PAGESPEED_THRESHOLDS.GOOD)       interp += 'Good performance for most use cases.';
    else if (mobileScore >= PAGESPEED_THRESHOLDS.NEEDS_WORK) interp += 'Performance needs optimization work before client delivery.';
    else                                                      interp += 'Poor performance - significant optimization or theme change recommended.';
    if (lcpMobile && lcpMobile > PAGESPEED_THRESHOLDS.LCP_POOR)       interp += ' LCP ' + lcpMobile + 's is poor (>4s).';
    else if (lcpMobile && lcpMobile > PAGESPEED_THRESHOLDS.LCP_GOOD)  interp += ' LCP ' + lcpMobile + 's needs improvement.';
    if (clsMobile && clsMobile > PAGESPEED_THRESHOLDS.CLS_POOR)       interp += ' CLS ' + clsMobile + ' indicates significant layout shift issues.';
    else if (clsMobile && clsMobile > PAGESPEED_THRESHOLDS.CLS_GOOD)  interp += ' CLS ' + clsMobile + ' shows minor layout shift.';
    return interp;
}

// ============================================
// SOURCE REFERENCE MANAGEMENT (v3.17 — Deep Walker)
// ============================================

var REMAP_EXCLUDED_KEYS = {
    'source_id': true, 'source_url': true, 'source_name': true, 'source_type': true,
    'demo_url': true, 'test_url': true, 'rating_url': true, 'link_url': true,
    'example_url': true, 'pagespeed_link': true, 'affiliate_link': true, 'video_url': true,
    'release_date': true, 'last_update': true, 'test_date': true, 'last_verification': true,
    'analysis_date': true, 'community_analysis_date': true,
    'performance_tier': true, 'activity_status': true, 'compatibility_status': true,
    'plugin_category': true, 'license_type': true, 'pricing_model': true,
    'update_policy': true, 'faq_category': true, 'category': true, 'sentiment': true,
    'severity': true, 'distribution_model': true,
    'search_profile': true,
    'version_reported': true,
    'scope': true,
    'date_reported': true,
    'source_date': true
};

function normalizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    var n = url.trim().toLowerCase();
    n = n.replace(/\/+$/, '');
    n = n.replace(/^(https?:\/\/)www\./, '$1');
    n = n.replace(/#.*$/, '');
    return n;
}

function extractSourceName(sourceField) {
    if (!sourceField || typeof sourceField !== 'string') return '';
    return sourceField.replace(/\s*\[[^\]]*\]\s*$/, '').trim();
}

function guessSourceType(url) {
    if (!url) return 'other';
    var l = url.toLowerCase();
    if (l.indexOf('reddit.com') !== -1)            return 'forum';
    if (l.indexOf('stackoverflow.com') !== -1)     return 'forum';
    if (l.indexOf('wordpress.org/support') !== -1) return 'forum';
    if (l.indexOf('support.') !== -1)              return 'forum';
    if (l.indexOf('forum') !== -1)                 return 'forum';
    if (l.indexOf('wpml.org/forums') !== -1)       return 'forum';
    if (l.indexOf('themeforest.net') !== -1)       return 'marketplace';
    if (l.indexOf('codecanyon.net') !== -1)        return 'marketplace';
    if (l.indexOf('creativemarket.com') !== -1)    return 'marketplace';
    if (l.indexOf('cvedetails.com') !== -1)        return 'documentation';
    if (l.indexOf('github.com') !== -1)            return 'documentation';
    if (l.indexOf('review') !== -1)                return 'review_site';
    if (l.indexOf('changelog') !== -1)             return 'official';
    return 'other';
}

function deepWalkAndRemap(node, currentKey, idMap, stats) {
    if (node === null || node === undefined) return node;
    if (Array.isArray(node)) {
        var result = [];
        for (var i = 0; i < node.length; i++) {
            var remapped = deepWalkAndRemap(node[i], currentKey, idMap, stats);
            if (currentKey === 'user_issues' && typeof remapped === 'string') {
                if (remapped.trim() === '' || !remapped.match(/\[\d+\]/)) { stats.orphansRemoved++; continue; }
            }
            result.push(remapped);
        }
        return result;
    }
    if (typeof node === 'object') {
        var obj = {}; var keys = Object.keys(node);
        for (var j = 0; j < keys.length; j++) obj[keys[j]] = deepWalkAndRemap(node[keys[j]], keys[j], idMap, stats);
        return obj;
    }
    if (typeof node === 'string') {
        if (REMAP_EXCLUDED_KEYS[currentKey]) return node;
        if (!node.match(/\[\d+\]/)) return node;
        if (currentKey === 'faq_source_ids') {
            var ids = node.split(','); var mapped = [];
            for (var k = 0; k < ids.length; k++) {
                var tid = ids[k].trim();
                if (idMap[tid]) { mapped.push(idMap[tid]); stats.refsFixed++; }
                else { stats.orphansRemoved++; }
            }
            return mapped.join(',');
        }
        var remappedText = node.replace(/\[(\d+)\]/g, function(match, id) {
            if (idMap[id]) { stats.refsFixed++; return '[' + idMap[id] + ']'; }
            stats.orphansRemoved++; return '';
        });
        remappedText = remappedText.replace(/\s{2,}/g, ' ').replace(/\s+\./g, '.').replace(/\s+,/g, ',').replace(/\s+;/g, ';').replace(/\.\./g, '.').trim();
        return remappedText;
    }
    return node;
}

function deepCountOrphans(node, currentKey, validIdSet) {
    if (node === null || node === undefined) return 0;
    if (Array.isArray(node)) {
        var count = 0;
        for (var i = 0; i < node.length; i++) count += deepCountOrphans(node[i], currentKey, validIdSet);
        return count;
    }
    if (typeof node === 'object') {
        var total = 0; var keys = Object.keys(node);
        for (var j = 0; j < keys.length; j++) total += deepCountOrphans(node[keys[j]], keys[j], validIdSet);
        return total;
    }
    if (typeof node === 'string') {
        if (REMAP_EXCLUDED_KEYS[currentKey]) return 0;
        var orphans = 0;
        if (currentKey === 'faq_source_ids') {
            var ids = node.split(',');
            for (var k = 0; k < ids.length; k++) { if (ids[k].trim() && !validIdSet[ids[k].trim()]) orphans++; }
        } else {
            var matches = node.match(/\[(\d+)\]/g) || [];
            for (var l = 0; l < matches.length; l++) { if (!validIdSet[matches[l].replace(/[\[\]]/g, '')]) orphans++; }
        }
        return orphans;
    }
    return 0;
}

function deepCollectAllIds(node, currentKey) {
    var ids = {};
    if (node === null || node === undefined) return ids;
    if (Array.isArray(node)) {
        for (var i = 0; i < node.length; i++) {
            var sub = deepCollectAllIds(node[i], currentKey); var sk = Object.keys(sub);
            for (var s = 0; s < sk.length; s++) ids[sk[s]] = true;
        }
        return ids;
    }
    if (typeof node === 'object') {
        var keys = Object.keys(node);
        for (var j = 0; j < keys.length; j++) {
            var sub2 = deepCollectAllIds(node[keys[j]], keys[j]); var sk2 = Object.keys(sub2);
            for (var s2 = 0; s2 < sk2.length; s2++) ids[sk2[s2]] = true;
        }
        return ids;
    }
    if (typeof node === 'string' && !REMAP_EXCLUDED_KEYS[currentKey]) {
        if (currentKey === 'faq_source_ids') {
            var parts = node.split(',');
            for (var k = 0; k < parts.length; k++) { if (parts[k].trim()) ids[parts[k].trim()] = true; }
        } else {
            var matches = node.match(/\[(\d+)\]/g) || [];
            for (var l = 0; l < matches.length; l++) ids[matches[l].replace(/[\[\]]/g, '')] = true;
        }
    }
    return ids;
}

function rebuildSourceReferences(data) {
    var stats = { collected: 0, deduped: 0, added: 0, refsFixed: 0, orphansRemoved: 0, idsBeforeRemap: 0, idsAfterRemap: 0 };
    if (!data.sources_methodology) {
        data.sources_methodology = { sources: [], methodology_note: '', analysis_date: '', data_timeframe: '', confidence_statement: '' };
    }
    var oldSources = data.sources_methodology.sources || [];
    var oldIdToUrl = {};
    for (var a = 0; a < oldSources.length; a++) {
        var s = oldSources[a]; var idMatch = (s.source_id || '').match(/\[(\d+)\]/);
        if (idMatch && isValidUrl(s.source_url)) oldIdToUrl[idMatch[1]] = s.source_url;
    }
    var urlRegistry = {};
    for (var b = 0; b < oldSources.length; b++) {
        if (isValidUrl(oldSources[b].source_url)) {
            var norm = normalizeUrl(oldSources[b].source_url);
            if (!urlRegistry[norm]) urlRegistry[norm] = { name: oldSources[b].source_name || '', type: oldSources[b].source_type || 'other', url: oldSources[b].source_url };
        }
    }
    var painPoints = (data.community_pain_points && data.community_pain_points.community_pain_points) || [];
    for (var c = 0; c < painPoints.length; c++) {
        if (isValidUrl(painPoints[c].source_url)) {
            var normPP = normalizeUrl(painPoints[c].source_url);
            if (!urlRegistry[normPP]) { urlRegistry[normPP] = { name: extractSourceName(painPoints[c].source), type: guessSourceType(painPoints[c].source_url), url: painPoints[c].source_url }; stats.added++; }
        }
    }
    var praiseStats = (data.community_pain_points && data.community_pain_points.community_praise_stats) || [];
    for (var d = 0; d < praiseStats.length; d++) {
        if (isValidUrl(praiseStats[d].source_url)) {
            var normPR = normalizeUrl(praiseStats[d].source_url);
            if (!urlRegistry[normPR]) { urlRegistry[normPR] = { name: extractSourceName(praiseStats[d].source), type: guessSourceType(praiseStats[d].source_url), url: praiseStats[d].source_url }; stats.added++; }
        }
    }
    var ratings = (data.theme_ratings && data.theme_ratings.external_ratings) || [];
    for (var e = 0; e < ratings.length; e++) {
        if (isValidUrl(ratings[e].rating_url)) {
            var normRT = normalizeUrl(ratings[e].rating_url);
            if (!urlRegistry[normRT]) { urlRegistry[normRT] = { name: ratings[e].rating_source || '', type: 'marketplace', url: ratings[e].rating_url }; stats.added++; }
        }
    }
    var urlKeys = Object.keys(urlRegistry); stats.collected = urlKeys.length;
    var newSources = []; var urlToNewId = {};
    for (var f = 0; f < urlKeys.length; f++) {
        var newId = String(f + 1); urlToNewId[urlKeys[f]] = newId;
        var entry = urlRegistry[urlKeys[f]];
        newSources.push({ source_id: '[' + newId + ']', source_name: entry.name, source_url: entry.url, source_type: entry.type });
    }
    var oldIdToNewId = {}; var oldIds = Object.keys(oldIdToUrl);
    for (var g = 0; g < oldIds.length; g++) {
        var oldNorm = normalizeUrl(oldIdToUrl[oldIds[g]]);
        if (urlToNewId[oldNorm]) oldIdToNewId[oldIds[g]] = urlToNewId[oldNorm];
    }
    var idsBefore = deepCollectAllIds(data, ''); stats.idsBeforeRemap = Object.keys(idsBefore).length;
    data.sources_methodology.sources = newSources;
    data = deepWalkAndRemap(data, '', oldIdToNewId, stats);
    data.sources_methodology.sources = newSources;
    var validIdSet = {};
    for (var m = 0; m < newSources.length; m++) {
        var sid = (newSources[m].source_id || '').match(/\[(\d+)\]/);
        if (sid) validIdSet[sid[1]] = true;
    }
    var remaining = deepCountOrphans(data, '', validIdSet);
    if (remaining > 0) stats.orphansRemoved += remaining;
    var idsAfter = deepCollectAllIds(data, ''); stats.idsAfterRemap = Object.keys(idsAfter).length;
    return { data: data, stats: stats };
}

// ============================================
// FALLBACK PRAISE GENERATOR
// ============================================

function generateFallbackPraise(data) {
    var fallbackPraise = [];
    var salesCount = 0, ratingScore = 0, ratingCount = 0, lastUpdate = '', sourceUrl = '';
    if (data.theme_basic) {
        if (data.theme_basic.sales_count) salesCount = parseInt(String(data.theme_basic.sales_count).replace(/[^0-9]/g, '')) || 0;
        lastUpdate = data.theme_basic.last_update || '';
    }
    if (data.theme_ratings && data.theme_ratings.external_ratings) {
        var r = data.theme_ratings.external_ratings;
        for (var i = 0; i < r.length; i++) {
            if (r[i].rating_score && r[i].rating_score > ratingScore) {
                ratingScore = r[i].rating_score; ratingCount = r[i].rating_count || 0; sourceUrl = r[i].rating_url || '';
            }
        }
    }
    var distModel = (data.theme_basic && data.theme_basic.distribution_model) || '';
    if (!sourceUrl) {
        if      (distModel === 'wordpress_org') sourceUrl = 'https://wordpress.org/themes/';
        else if (distModel === 'direct_sale')   sourceUrl = data.theme_basic && data.theme_basic.demo_url ? data.theme_basic.demo_url : '';
        else                                    sourceUrl = 'https://themeforest.net';
    }
    var marketplaceLabel = 'ThemeForest Marketplace', reviewsLabel = 'ThemeForest Reviews', countLabel = 'sales';
    if (distModel === 'wordpress_org') { marketplaceLabel = 'WordPress.org Repository'; reviewsLabel = 'WordPress.org Reviews'; countLabel = 'active installs'; }
    else if (distModel === 'direct_sale') { marketplaceLabel = 'Author Website'; reviewsLabel = 'User Reviews'; countLabel = 'users'; }

    if (salesCount > 50000) {
        fallbackPraise.push({ category: 'marketplace', sentiment: 'positive', positive_aspect: 'Popular choice with strong market presence', strength: salesCount.toLocaleString() + '+ ' + countLabel + ' indicates sustained market trust', title: 'Market Popularity', description: 'High ' + countLabel + ' count demonstrates that many professionals trust this theme for client projects.', frequency: 'verified', percentage: 0, source: marketplaceLabel + ' [marketplace]', source_url: sourceUrl });
    } else if (salesCount > 10000) {
        fallbackPraise.push({ category: 'marketplace', sentiment: 'positive', positive_aspect: 'Established theme with solid user base', strength: salesCount.toLocaleString() + '+ ' + countLabel + ' shows proven track record', title: 'Established Product', description: 'Significant ' + countLabel + ' count indicates a mature, tested product.', frequency: 'verified', percentage: 0, source: marketplaceLabel + ' [marketplace]', source_url: sourceUrl });
    }
    if (ratingScore >= 4.5 && ratingCount > 100) {
        fallbackPraise.push({ category: 'marketplace', sentiment: 'positive', positive_aspect: 'High user satisfaction rating', strength: ratingScore + '/5 average from ' + ratingCount.toLocaleString() + ' reviews', title: 'User Satisfaction', description: 'Consistently high ratings from a large number of buyers indicates quality and reliability.', frequency: 'verified', percentage: 0, source: reviewsLabel + ' [marketplace]', source_url: sourceUrl });
    } else if (ratingScore >= 4.0 && ratingCount > 50) {
        fallbackPraise.push({ category: 'marketplace', sentiment: 'positive', positive_aspect: 'Good user ratings', strength: ratingScore + '/5 average rating', title: 'Positive Reviews', description: 'Above-average ratings indicate generally satisfied users.', frequency: 'verified', percentage: 0, source: reviewsLabel + ' [marketplace]', source_url: sourceUrl });
    }
    if (lastUpdate) {
        var updateDate = new Date(lastUpdate); var now = new Date();
        var monthsAgo = (now.getFullYear() - updateDate.getFullYear()) * 12 + (now.getMonth() - updateDate.getMonth());
        if (monthsAgo <= 3) {
            fallbackPraise.push({ category: 'updates', sentiment: 'positive', positive_aspect: 'Actively maintained', strength: 'Updated within last ' + (monthsAgo === 0 ? '1' : monthsAgo) + ' month(s)', title: 'Active Development', description: 'Recent updates indicate ongoing support and compatibility maintenance.', frequency: 'verified', percentage: 0, source: 'Theme Changelog [official]', source_url: sourceUrl });
        } else if (monthsAgo <= 6) {
            fallbackPraise.push({ category: 'updates', sentiment: 'positive', positive_aspect: 'Regular maintenance', strength: 'Updated within last 6 months', title: 'Maintained Product', description: 'Regular updates show the developer actively supports this theme.', frequency: 'verified', percentage: 0, source: 'Theme Changelog [official]', source_url: sourceUrl });
        }
    }
    var pm = data.performance_metrics || {};
    var perfTier = (pm.performance_tier || '').toLowerCase();
    var mobScore = pm.pagespeed_mobile || 0;
    var perfUrl = pm.test_url || pm.pagespeed_link || sourceUrl;
    if (perfTier === 'excellent' || mobScore >= 90) {
        fallbackPraise.push({ category: 'performance', sentiment: 'positive', positive_aspect: 'Excellent performance scores', strength: 'Mobile PageSpeed ' + mobScore + '/100 (' + perfTier + ' tier)', title: 'Top-Tier Performance', description: 'Achieves excellent Core Web Vitals and PageSpeed scores, indicating clean code output and efficient asset loading.', frequency: 'verified', percentage: 0, source: 'PageSpeed Insights [performance]', source_url: perfUrl });
    } else if (perfTier === 'good' || mobScore >= 75) {
        fallbackPraise.push({ category: 'performance', sentiment: 'positive', positive_aspect: 'Good performance scores', strength: 'Mobile PageSpeed ' + mobScore + '/100 (' + perfTier + ' tier)', title: 'Solid Performance', description: 'Achieves good PageSpeed scores, providing a solid performance foundation for most projects.', frequency: 'verified', percentage: 0, source: 'PageSpeed Insights [performance]', source_url: perfUrl });
    }
    var codeQuality = (data.theme_basic && data.theme_basic.code_quality || '').toLowerCase();
    if (codeQuality === 'high' || codeQuality === 'premium') {
        fallbackPraise.push({ category: 'development', sentiment: 'positive', positive_aspect: 'High code quality standards', strength: 'Code quality rated as ' + codeQuality, title: 'Professional Code Quality', description: 'The theme demonstrates professional coding standards, which contributes to maintainability and compatibility.', frequency: 'verified', percentage: 0, source: 'Code Analysis [official]', source_url: sourceUrl });
    }
    return fallbackPraise;
}

// ============================================
// SEARCH PROFILE GENERATOR (v3.19.0+)
// ============================================

function resolveArchitectureTag(taxonomyJson) {
    if (!taxonomyJson) return null;
    try {
        var tx = typeof taxonomyJson === 'string' ? JSON.parse(taxonomyJson) : taxonomyJson;
        var ids = tx.theme_architecture;
        if (!ids || !ids.length) return null;
        var id = ids[0]; var terms = TAXONOMY_CONFIG.theme_architecture.terms;
        for (var slug in terms) { if (terms[slug] === id) return slug; }
    } catch (e) {}
    return null;
}

function generateSearchProfile(data, themeName, taxonomyJson) {
    var name = (themeName || '').trim();
    if (!name) return '';
    var pm = data.performance_metrics || {};
    var hd = data.handoff_difficulty || {};
    var tp = data.theme_pricing || {};
    var hs = data.human_summary || {};
    var tb = data.theme_basic || {};
    var plugins = (data.plugin_compatibility_enhanced && data.plugin_compatibility_enhanced.plugin_compatibility_list) || [];
    var tier = (pm.performance_tier || '').toLowerCase();
    var mob = pm.pagespeed_mobile || 0;
    var desk = pm.pagespeed_desktop || 0;
    var resolvedTier = tier || (mob >= 90 ? 'excellent' : mob >= 70 ? 'good' : mob >= 50 ? 'needs_work' : mob > 0 ? 'poor' : 'unknown');
    var perfStr = mob > 0 ? 'perf:' + resolvedTier + '(' + mob + 'mob,' + desk + 'desk)' : 'perf:' + resolvedTier;
    var model = (tp.pricing_model || 'unknown').toLowerCase()
        .replace('one_time_purchase', 'one-time').replace('annual_subscription', 'annual').replace('lifetime_license', 'lifetime');
    var price = tp.base_price || 0;
    var priceStr = 'price:' + model + (price > 0 ? '($' + price + ')' : '');
    var hscore = hd.handoff_score || 0;
    var hcmplx = (hd.handoff_panel_complexity || 'unknown').toLowerCase();
    var handoffStr = 'handoff:' + hscore + '/' + hcmplx;
    var ideal = (hs.summary_ideal_for || []).map(function(s) {
        return s.replace(/[,\/\s]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    }).filter(Boolean).slice(0, 4).join(',');
    var avoid = (hs.summary_not_for || []).map(function(s) {
        return s.replace(/[,\/\s]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    }).filter(Boolean).slice(0, 3).join(',');
    var tags = [];
    var builderMap = { 'elementor': 'elementor', 'divi': 'divi', 'bricks': 'bricks', 'gutenberg': 'gutenberg', 'wpbakery': 'wpbakery', 'beaver': 'beaver' };
    var nameNorm = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    var authorNorm = ((tb.theme_author || '') + '').toLowerCase().replace(/[^a-z0-9]/g, '');
    for (var bSelf in builderMap) {
        if (nameNorm.indexOf(bSelf) !== -1 || authorNorm === bSelf) {
            tags.push(builderMap[bSelf]);
        }
    }
    plugins.forEach(function(p) {
        var pname = (p.plugin || '').toLowerCase();
        var status = (p.compatibility_status || 'full').toLowerCase();
        if ((p.plugin_category || '') !== 'page_builder') return;
        for (var b in builderMap) {
            if (pname.indexOf(b) === -1) continue;
            var tag = builderMap[b];
            var suffixedTag = status === 'none' ? tag + ':incompatible' : (status === 'partial' || status === 'limited') ? tag + ':partial' : tag;
            if (tags.indexOf(suffixedTag) === -1) tags.push(suffixedTag);
        }
    });
    var bundledPlugins = data.bundled_plugins || [];
    bundledPlugins.forEach(function(bp) {
        if ((bp.plugin_category || '') !== 'page_builder') return;
        var bname = (bp.plugin_name || '').toLowerCase();
        for (var b in builderMap) {
            if (bname.indexOf(b) === -1) continue;
            var tag = builderMap[b];
            var alreadyTagged = tags.some(function(t) { return t === tag || t.indexOf(tag + ':') === 0; });
            if (!alreadyTagged) tags.push(tag);
        }
    });
    var compatPluginNames = plugins.map(function(p) { return (p.plugin || '').toLowerCase(); });
    var fullText = JSON.stringify(data).toLowerCase();
    var builderTextScan = { 'elementor': 'elementor', 'wpbakery': 'wpbakery', 'divi': 'divi', 'bricks': 'bricks', 'beaver': 'beaver' };
    var SCAN_THRESHOLD = 3;
    for (var bScan in builderTextScan) {
        var bTag = builderTextScan[bScan];
        if (nameNorm.indexOf(bScan) !== -1 || authorNorm.indexOf(bScan) !== -1) continue;
        var alreadyScanTagged = tags.some(function(t) { return t === bTag || t.indexOf(bTag + ':') === 0; });
        if (alreadyScanTagged) continue;
        var inCompatList = compatPluginNames.some(function(cn) { return cn.indexOf(bScan) !== -1; });
        if (!inCompatList) continue;
        var bCount = 0, bPos = 0;
        while ((bPos = fullText.indexOf(bScan, bPos)) !== -1) { bCount++; bPos += bScan.length; }
        if (bCount >= SCAN_THRESHOLD) tags.push(bTag + ':partial');
    }
    var dist = (tb.distribution_model || '').toLowerCase();
    if      (dist === 'wordpress_org') tags.push('wordpress-org');
    else if (dist === 'direct_sale')   tags.push('direct-sale');
    else if (dist === 'themeforest')   tags.push('themeforest');
    var themeTypes = (taxonomyJson && taxonomyJson.theme_types) || [];
    var isWooTheme = themeTypes.some(function(t) { return (t || '').toLowerCase().indexOf('woocommerce') !== -1; });
    if (isWooTheme) tags.push('woocommerce');
    var archTag = resolveArchitectureTag(taxonomyJson);
    if (!archTag) {
        var tagline = (tb.theme_tagline || '').toLowerCase();
        var summaryStr = JSON.stringify(hs).toLowerCase();
        if (tagline.indexOf('fse') !== -1 || tagline.indexOf('block theme') !== -1 || summaryStr.indexOf('full site edit') !== -1) archTag = 'block-fse';
        else if (tagline.indexOf('hybrid') !== -1 || summaryStr.indexOf('hybrid') !== -1) archTag = 'hybrid';
        else archTag = 'classic';
    }
    tags.push(archTag);
    var painPoints = (data.community_pain_points && data.community_pain_points.community_pain_points) || [];
    var secKeywords = ['vulnerab', 'cve', 'exploit', 'malware', 'backdoor', 'xss attack', 'sql inject', 'remote code execution', 'rce', 'csrf attack', 'privilege escalat', 'zero-day', '0-day'];
    var hasCritical = painPoints.some(function(pp) {
        if (pp.severity !== 'critical') return false;
        if (pp.stale) return false;
        var text = ((pp.category || '') + (pp.title || '') + (pp.description || '')).toLowerCase();
        return secKeywords.some(function(k) { return text.indexOf(k) !== -1; });
    });
    var hasMajorSec = painPoints.some(function(pp) {
        if (pp.severity !== 'major') return false;
        if (pp.stale) return false;
        var text = ((pp.category || '') + (pp.title || '') + (pp.description || '')).toLowerCase();
        return secKeywords.some(function(k) { return text.indexOf(k) !== -1; });
    });
    if      (hasCritical) tags.push('security:critical-historical');
    else if (hasMajorSec) tags.push('security:major-historical');
    var salesRaw = String(tb.sales_count || '').replace(/[^0-9]/g, '');
    var salesNum = parseInt(salesRaw, 10) || 0;
    if      (salesNum >= 200000) tags.push('200k+installs');
    else if (salesNum >= 100000) tags.push('100k+installs');
    else if (salesNum >= 50000)  tags.push('50k+installs');
    else if (salesNum >= 10000)  tags.push('10k+installs');
    else if (salesNum >= 1000)   tags.push('1k+installs');
    var parts = [name, perfStr, priceStr, handoffStr,
        ideal ? 'ideal:' + ideal : null, avoid ? 'avoid:' + avoid : null,
        tags.length > 0 ? 'tags:' + tags.join(',') : null
    ].filter(Boolean);
    return parts.join('|');
}

// ============================================
// CLEANUP FUNCTIONS
// ============================================

// v3.20.2: Parse changelog text into date→version map
// Expected formats in changelog:
//   "= 1.4.5 | February 25th, 2026 ="
//   "**1.4.5 - 2026-02-25**"
//   "Version 1.4.5 (2026-02-25)"
//   "## [3.3.1] - 2024-12-10"
function parseChangelogVersions(changelogText) {
    if (!changelogText || changelogText.trim().length < 20) return [];
    var entries = [];
    var lines = changelogText.split('\n');
    var versionPattern = /(?:^|[\s=*#\[])(\d+\.\d+(?:\.\d+)?)\s*[\|\-–—]\s*(.+?)(?:\s*[=*\]]*$)/;
    var datePatterns = [
        /(\d{4})-(\d{2})-(\d{2})/,
        /(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})/,
        /(\d{1,2})\s+(\w+)\s+(\d{4})/
    ];
    var months = { january:1, february:2, march:3, april:4, may:5, june:6, july:7, august:8, september:9, october:10, november:11, december:12, jan:1, feb:2, mar:3, apr:4, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        var vm = line.match(versionPattern);
        if (!vm) continue;
        var version = vm[1];
        var dateStr = vm[2] || line;
        var parsed = null;
        var iso = dateStr.match(datePatterns[0]);
        if (iso) { parsed = iso[1] + '-' + iso[2]; }
        if (!parsed) {
            var mdy = dateStr.match(datePatterns[1]);
            if (mdy) { var mon = months[mdy[1].toLowerCase()]; if (mon) parsed = mdy[3] + '-' + (mon < 10 ? '0' + mon : '' + mon); }
        }
        if (!parsed) {
            var dmy = dateStr.match(datePatterns[2]);
            if (dmy) { var mon2 = months[dmy[2].toLowerCase()]; if (mon2) parsed = dmy[3] + '-' + (mon2 < 10 ? '0' + mon2 : '' + mon2); }
        }
        if (parsed && version) { entries.push({ version: version, date: parsed }); }
    }
    entries.sort(function(a, b) { return b.date.localeCompare(a.date); });
    return entries;
}

// Given a YYYY-MM date and a sorted changelog entries array,
// find the version that was CURRENT on that date (= latest release on or before that date)
function findVersionForDate(dateYYYYMM, changelogEntries) {
    if (!dateYYYYMM || dateYYYYMM === 'date-unknown' || !changelogEntries.length) return null;
    for (var i = 0; i < changelogEntries.length; i++) {
        if (changelogEntries[i].date <= dateYYYYMM) { return changelogEntries[i].version; }
    }
    return null;
}

function cleanupOutput(jsonString, themeName, taxonomyJson, changelogText) {
    var data;
    try { data = JSON.parse(jsonString); } catch (e) { throw new Error('Invalid JSON: ' + e.message); }
    jsonString = JSON.stringify(data).replace(/\[ID\s*(\d+)\]/gi, '[$1]');
    data = JSON.parse(jsonString);
    var stats = {
        sourcesRemoved: 0, sourcesAdded: 0, pluginsRemoved: 0,
        companionPluginsRemoved: 0, stalePainPointsDegraded: 0,
        painPointsRemoved: 0, praiseRemoved: 0, praiseFallbackGenerated: 0,
        faqCleared: false, ratingsRemoved: 0, ratingsWarning: null, verdictsCleared: 0,
        performanceIssues: [], handoffFixed: null, painPointsWarning: null,
        sourceRefsFixed: 0, sourceOrphansRemoved: 0, sourcesFinal: 0,
        idsBeforeRemap: 0, idsAfterRemap: 0, codeQualityFixed: null,
        searchProfileGenerated: false, sourceDatesInferred: 0, versionsInferred: 0,
        pluginCompatDegraded: 0, resolutionWarning: null, summaryRecommendationEmpty: false, quickConsStaleWarning: null
    };
    var themePrefix = (themeName || '').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 8);
    if (data.theme_basic && data.theme_basic.code_quality) {
        var cqMap = { beginner: 'basic', intermediate: 'good', advanced: 'high', expert: 'premium' };
        var cq = data.theme_basic.code_quality.toLowerCase().trim();
        if (cqMap[cq]) { data.theme_basic.code_quality = cqMap[cq]; stats.codeQualityFixed = cq + '→' + cqMap[cq]; }
        else if (['basic', 'good', 'high', 'premium'].indexOf(cq) === -1) { data.theme_basic.code_quality = 'good'; stats.codeQualityFixed = cq + '→good (fallback)'; }
    }
    // v3.20.0: Ensure scope field exists on all pain points and praise
    if (data.community_pain_points && data.community_pain_points.community_pain_points) { data.community_pain_points.community_pain_points.forEach(function(pp) { if (!pp.scope) pp.scope = 'theme'; }); }
    if (data.community_pain_points && data.community_pain_points.community_praise_stats) { data.community_pain_points.community_praise_stats.forEach(function(p) { if (!p.scope) p.scope = 'theme'; }); }
    // v3.20.2: Validate and fix pain point category enum
    var VALID_PAIN_CATEGORIES = ['performance', 'handoff', 'updates', 'plugin_compat', 'support', 'cost', 'general'];
    if (data.community_pain_points && data.community_pain_points.community_pain_points) {
        data.community_pain_points.community_pain_points.forEach(function(pp) {
            if (pp.category && VALID_PAIN_CATEGORIES.indexOf(pp.category.toLowerCase()) === -1) {
                var cat = pp.category.toLowerCase();
                if (cat === 'hosting' || cat === 'server' || cat === 'infrastructure') pp.category = 'general';
                else if (cat === 'development' || cat === 'developer' || cat === 'coding') pp.category = 'general';
                else if (cat === 'security' || cat === 'vulnerability') pp.category = 'general';
                else if (cat === 'compatibility' || cat === 'conflict') pp.category = 'plugin_compat';
                else if (cat === 'pricing' || cat === 'license') pp.category = 'cost';
                else if (cat === 'documentation' || cat === 'docs') pp.category = 'support';
                else pp.category = 'general';
            }
        });
    }
    if (data.community_pain_points && data.community_pain_points.community_pain_points) {
        var origPainCount = data.community_pain_points.community_pain_points.length;
        data.community_pain_points.community_pain_points = data.community_pain_points.community_pain_points.filter(function(p) { return isValidUrl(p.source_url); });
        stats.painPointsRemoved = origPainCount - data.community_pain_points.community_pain_points.length;
        data.community_pain_points.community_total_discussions = data.community_pain_points.community_pain_points.length;
    }
    if (data.community_pain_points && data.community_pain_points.community_pain_points && data.theme_basic && data.theme_basic.theme_version) {
        var currentVersion = (data.theme_basic.theme_version || '').trim();
        var currentParts = currentVersion.split('.');
        var currentMajor = parseInt(currentParts[0], 10) || 0;
        var currentMinor = parseInt(currentParts[1], 10) || 0;
        data.community_pain_points.community_pain_points.forEach(function(pp) {
            var reported = (pp.version_reported || '').trim().toLowerCase();
            if (!reported || reported === 'unknown' || reported === '') return;
            reported = reported.replace(/^[<>=~^!]+\s*/, '').replace(/^v/, '').trim();
            reported = reported.replace(/\s*\(.*\)$/, '').trim(); // strip "(inferred from date)" suffix
            if (!reported) return;
            var rParts = reported.split('.');
            var rMajor = parseInt(rParts[0], 10) || 0;
            var rMinor = parseInt(rParts[1], 10) || 0;
            if (rMajor === 0) return;
            var isStale = false;
            if (currentMajor > rMajor) { isStale = true; }
            else if (currentMajor === rMajor && (currentMinor - rMinor) >= 2) { isStale = true; }
            if (isStale) {
                if (pp.severity === 'critical') pp.severity = 'major';
                else if (pp.severity === 'major') pp.severity = 'moderate';
                pp.stale = true;
                if (pp.title && pp.title.indexOf('(unverified') === -1) { pp.title = pp.title + ' (unverified in v' + currentVersion + ')'; }
                stats.stalePainPointsDegraded++;
            }
        });
    }
    // v3.20.0: Date-based stale detection (supplements version-based)
    if (data.community_pain_points && data.community_pain_points.community_pain_points) { var nowDate = new Date(); var staleThreshold = new Date(nowDate.getFullYear(), nowDate.getMonth() - STALE_DATE_MONTHS, 1); data.community_pain_points.community_pain_points.forEach(function(pp) { if (pp.stale) return; var dateStr = (pp.date_reported || '').trim(); if (!dateStr || dateStr === 'date-unknown') return; var dParts = dateStr.split('-'); if (dParts.length < 2) return; var reportedDate = new Date(parseInt(dParts[0], 10), parseInt(dParts[1], 10) - 1, 1); if (reportedDate < staleThreshold) { if (pp.severity === 'critical') pp.severity = 'major'; else if (pp.severity === 'major') pp.severity = 'moderate'; if (pp.severity === 'moderate') pp.severity = 'minor'; pp.stale = true; if (pp.title && pp.title.indexOf('(historical') === -1) { pp.title = pp.title + ' (historical — unconfirmed current)'; } stats.stalePainPointsDegraded++; } }); }
    // v3.20.2: Infer version_reported from changelog dates
    var changelogEntries = parseChangelogVersions(changelogText);
    if (changelogEntries.length > 0 && data.community_pain_points && data.community_pain_points.community_pain_points) {
        var versionsInferred = 0;
        data.community_pain_points.community_pain_points.forEach(function(pp) {
            var vr = (pp.version_reported || '').trim().toLowerCase();
            if (vr && vr !== 'unknown' && vr !== '') return;
            var dr = (pp.date_reported || '').trim();
            if (!dr || dr === 'date-unknown') return;
            var inferred = findVersionForDate(dr, changelogEntries);
            if (inferred) { pp.version_reported = '~' + inferred + ' (inferred from date)'; versionsInferred++; }
        });
        if (versionsInferred > 0) stats.versionsInferred = versionsInferred;
    }
    if (data.community_pain_points && data.community_pain_points.community_praise_stats) {
        var origPraiseCount = data.community_pain_points.community_praise_stats.length;
        data.community_pain_points.community_praise_stats = data.community_pain_points.community_praise_stats.filter(function(praise) {
            if (!isValidUrl(praise.source_url)) return false;
            var hasContent = (praise.positive_aspect && praise.positive_aspect.trim().length > 0) || (praise.strength && praise.strength.trim().length > 0) || (praise.title && praise.title.trim().length > 0);
            var hasPercentage = praise.percentage && praise.percentage > 0;
            var hasFrequency = praise.frequency && praise.frequency.trim().length > 0;
            return hasContent && (hasPercentage || hasFrequency);
        });
        stats.praiseRemoved = origPraiseCount - data.community_pain_points.community_praise_stats.length;
    }
    if (data.community_pain_points) {
        var currentPraise = data.community_pain_points.community_praise_stats || [];
        if (currentPraise.length < 3) {
            var fallback = generateFallbackPraise(data);
            var existingCategories = {};
            currentPraise.forEach(function(p) { existingCategories[p.category || ''] = true; });
            var supplemental = fallback.filter(function(f) { return !existingCategories[f.category || '']; });
            var needed = 3 - currentPraise.length;
            if (supplemental.length > 0) {
                data.community_pain_points.community_praise_stats = currentPraise.concat(supplemental.slice(0, needed));
                stats.praiseFallbackGenerated = Math.min(supplemental.length, needed);
            }
        }
    }
    if (data.plugin_compatibility_enhanced && data.plugin_compatibility_enhanced.plugin_compatibility_list) {
        var origPluginCount = data.plugin_compatibility_enhanced.plugin_compatibility_list.length;
        var bundledNames = {};
        if (data.bundled_plugins && Array.isArray(data.bundled_plugins)) { data.bundled_plugins.forEach(function(bp) { if (bp.plugin_name) bundledNames[bp.plugin_name.toLowerCase().trim()] = true; }); }
        data.plugin_compatibility_enhanced.plugin_compatibility_list = data.plugin_compatibility_enhanced.plugin_compatibility_list.filter(function(plugin) {
            var status = (plugin.compatibility_status || '').toLowerCase().trim();
            if (CLEANUP_CONFIG.INVALID_PLUGIN_STATUSES.includes(status) || status === '') return false;
            var name = (plugin.plugin || '').toLowerCase();
            if (/^php\b/.test(name)) return false;
            if (bundledNames[name]) return false;
            if (themePrefix.length >= 4) {
                var nameNorm = name.replace(/[^a-z0-9]/g, '');
                if (nameNorm.indexOf(themePrefix) === 0 && nameNorm.length > themePrefix.length) { stats.companionPluginsRemoved++; return false; }
            }
            return true;
        });
        stats.pluginsRemoved = origPluginCount - data.plugin_compatibility_enhanced.plugin_compatibility_list.length;
        var pluginList = data.plugin_compatibility_enhanced.plugin_compatibility_list;
        data.plugin_compatibility_enhanced.compat_total_tested = pluginList.length;
        data.plugin_compatibility_enhanced.compat_full_compatible = pluginList.filter(function(p) { return p.compatibility_status === 'full'; }).length;
        data.plugin_compatibility_enhanced.compat_issues_found = pluginList.filter(function(p) { return ['partial', 'limited', 'none'].includes(p.compatibility_status); }).length;
    }
    // v3.20.1: Auto-fix compat_sources_count from actual citations
    if (data.plugin_compatibility_enhanced) {
        var compatSrcIds = {};
        (data.plugin_compatibility_enhanced.plugin_compatibility_list || []).forEach(function(p) {
            (p.user_issues || []).forEach(function(ref) {
                var m = ref.match(/\[(\d+)\]/g) || [];
                m.forEach(function(id) { compatSrcIds[id] = true; });
            });
        });
        var autoCount = Object.keys(compatSrcIds).length;
        if (autoCount > (data.plugin_compatibility_enhanced.compat_sources_count || 0)) {
            data.plugin_compatibility_enhanced.compat_sources_count = autoCount;
        }
    }
    // v3.20.3: Stale-aware plugin_compatibility_list degradation
    // staleMap[id] = true only if confirmed stale; undefined/false → conservative non-stale
    if (data.plugin_compatibility_enhanced && data.community_pain_points && data.community_pain_points.community_pain_points) {
        var staleMap = {};
        data.community_pain_points.community_pain_points.forEach(function(pp) {
            var m = (pp.source || '').match(/\[(\d+)\]/g) || [];
            m.forEach(function(id) {
                if (pp.stale && staleMap[id] !== false) { staleMap[id] = true; }
                else { staleMap[id] = false; }
            });
        });
        var pluginCompatDegraded = 0;
        (data.plugin_compatibility_enhanced.plugin_compatibility_list || []).forEach(function(plugin) {
            if (!plugin.user_issues || plugin.user_issues.length === 0) return;
            var allStale = true;
            plugin.user_issues.forEach(function(ref) {
                var id = (ref || '').match(/\[(\d+)\]/);
                if (!id) return;
                if (staleMap[id[1]] !== true) { allStale = false; }
            });
            if (allStale) {
                plugin.compatibility_status = 'previously_reported';
                plugin.compatibility_notes = (plugin.compatibility_notes || '') + ' (based on reports older than current version — retest recommended)';
                pluginCompatDegraded++;
            }
        });
        if (pluginCompatDegraded > 0) stats.pluginCompatDegraded = pluginCompatDegraded;
    }
    // v3.20.3: quick_cons stale reference warning
    if (data.quick_overview && data.quick_overview.quick_cons && data.community_pain_points && data.community_pain_points.community_pain_points) {
        var ppListQ = data.community_pain_points.community_pain_points;
        var catKeywords = { plugin_compat: ['plugin', 'compat', 'woocommerce', 'wpml', 'conflict', 'elementor', 'acf'], updates: ['update', 'version', 'breaking', 'changelog'], performance: ['speed', 'slow', 'performance', 'lcp', 'cls', 'page'], handoff: ['setup', 'complex', 'learning', 'panel', 'docs'], support: ['support', 'help', 'documentation', 'ticket'], cost: ['price', 'cost', 'paid', 'license', 'expensive'] };
        var quickConsWarnings = [];
        (data.quick_overview.quick_cons || []).forEach(function(con, idx) {
            var conText = (con.con_text || '').toLowerCase();
            var mentionedCategories = [];
            Object.keys(catKeywords).forEach(function(cat) { catKeywords[cat].forEach(function(kw) { if (conText.indexOf(kw) !== -1 && mentionedCategories.indexOf(cat) === -1) mentionedCategories.push(cat); }); });
            if (mentionedCategories.length === 0) return;
            var allStaleForCon = mentionedCategories.every(function(cat) {
                var catPps = ppListQ.filter(function(pp) { return pp.category === cat; });
                if (catPps.length === 0) return false;
                return catPps.every(function(pp) { return pp.stale; });
            });
            if (allStaleForCon) quickConsWarnings.push('quick_cons[' + idx + '] may reference stale issues only');
        });
        if (quickConsWarnings.length > 0) stats.quickConsStaleWarning = quickConsWarnings.join('; ');
    }
    if (data.bundled_plugins && Array.isArray(data.bundled_plugins)) {
        var origBundledCount = data.bundled_plugins.length;
        var painTexts = '';
        if (data.community_pain_points && data.community_pain_points.community_pain_points) { data.community_pain_points.community_pain_points.forEach(function(pp) { painTexts += ' ' + (pp.title || '') + ' ' + (pp.description || '') + ' ' + (pp.resolution || ''); }); }
        painTexts = painTexts.toLowerCase();
        var distModelB = (data.theme_basic && data.theme_basic.distribution_model) || '';
        data.bundled_plugins = data.bundled_plugins.filter(function(bp) {
            var name = (bp.plugin_name || '').toLowerCase(); var shortName = name.split('(')[0].trim();
            var license = (bp.license_type || '').toLowerCase(); var funcText = (bp.plugin_functionality || '').toLowerCase();
            var isProblematic = false;
            var removalKeywords = ['removed', 'closed', 'not allowed', 'licensing conflict', 'license issue', 'temporarily', 'reinstated'];
            if (shortName.length >= 3 && painTexts.indexOf(shortName) !== -1) { for (var i = 0; i < removalKeywords.length; i++) { if (painTexts.indexOf(removalKeywords[i]) !== -1) { isProblematic = true; break; } } }
            if (distModelB === 'wordpress_org' && (license === 'proprietary' || license === 'limited')) isProblematic = true;
            if (funcText.indexOf('removal') !== -1 || funcText.indexOf('licensing conflict') !== -1 || funcText.indexOf('temporarily closed') !== -1) isProblematic = true;
            return !isProblematic;
        });
        stats.bundledPluginsRemoved = origBundledCount - data.bundled_plugins.length;
    }
    if (data.theme_ratings && data.theme_ratings.external_ratings) {
        var origRatingsCount = data.theme_ratings.external_ratings.length;
        data.theme_ratings.external_ratings = data.theme_ratings.external_ratings.filter(function(r) { return isValidUrl(r.rating_url); });
        stats.ratingsRemoved = origRatingsCount - data.theme_ratings.external_ratings.length;
    }
    if (data.theme_ratings && (!data.theme_ratings.external_ratings || data.theme_ratings.external_ratings.length === 0)) { stats.ratingsWarning = 'No external ratings — verify manually'; }
    var srcResult = rebuildSourceReferences(data);
    data = srcResult.data; stats.sourceRefsFixed = srcResult.stats.refsFixed; stats.sourceOrphansRemoved = srcResult.stats.orphansRemoved; stats.sourcesAdded = srcResult.stats.added; stats.idsBeforeRemap = srcResult.stats.idsBeforeRemap; stats.idsAfterRemap = srcResult.stats.idsAfterRemap;
    stats.sourcesFinal = (data.sources_methodology && data.sources_methodology.sources) ? data.sources_methodology.sources.length : 0;
    // v3.20.2: Infer source_date from pain points and praise date_reported
    if (data.sources_methodology && data.sources_methodology.sources) {
        var urlToDate = {};
        if (data.community_pain_points && data.community_pain_points.community_pain_points) {
            data.community_pain_points.community_pain_points.forEach(function(pp) {
                var d = (pp.date_reported || '').trim();
                if (d && d !== 'date-unknown' && pp.source_url) {
                    var normUrl = normalizeUrl(pp.source_url);
                    if (!urlToDate[normUrl]) urlToDate[normUrl] = d;
                }
            });
        }
        if (data.community_pain_points && data.community_pain_points.community_praise_stats) {
            data.community_pain_points.community_praise_stats.forEach(function(pr) {
                if (pr.source_url && pr.source) {
                    var dateMatch = (pr.source || '').match(/(\d{4}-\d{2})/);
                    if (dateMatch) {
                        var normUrl = normalizeUrl(pr.source_url);
                        if (!urlToDate[normUrl]) urlToDate[normUrl] = dateMatch[1];
                    }
                }
            });
        }
        var sourceDatesInferred = 0;
        data.sources_methodology.sources.forEach(function(src) {
            if (src.source_date && src.source_date !== '' && src.source_date !== 'date-unknown') return;
            var normSrcUrl = normalizeUrl(src.source_url);
            if (urlToDate[normSrcUrl]) { src.source_date = urlToDate[normSrcUrl]; sourceDatesInferred++; }
            else if (!src.source_date) { src.source_date = 'date-unknown'; }
        });
        if (sourceDatesInferred > 0) stats.sourceDatesInferred = sourceDatesInferred;
    }
    var validSourcesCount = stats.sourcesFinal;
    if (validSourcesCount < CLEANUP_CONFIG.MIN_SOURCES_FOR_FAQ) { if (data.faq && data.faq.faq_items && data.faq.faq_items.length > 0) { data.faq.faq_items = []; data.faq.faq_generation_note = 'FAQ cleared: insufficient sources (' + validSourcesCount + ' < ' + CLEANUP_CONFIG.MIN_SOURCES_FOR_FAQ + ')'; stats.faqCleared = true; } }
    var verdictResult = cleanShortVerdicts(data); data = verdictResult.data; stats.verdictsCleared = verdictResult.cleared;
    var perfResult = validatePerformanceConsistency(data); data = perfResult.data; stats.performanceIssues = perfResult.issues;
    var handoffResult = fixHandoffScore(data); data = handoffResult.data;
    if (handoffResult.changed) stats.handoffFixed = handoffResult.oldScore + '→' + handoffResult.newScore;
    if (data.community_pain_points && data.community_pain_points.community_pain_points && data.community_pain_points.community_pain_points.length < CLEANUP_CONFIG.MIN_PAIN_POINTS) { stats.painPointsWarning = 'Only ' + data.community_pain_points.community_pain_points.length + ' pain points (min: ' + CLEANUP_CONFIG.MIN_PAIN_POINTS + ')'; }
    // v3.20.3: Validate empty resolution and summary_recommendation
    if (data.community_pain_points && data.community_pain_points.community_pain_points) {
        var ppAll = data.community_pain_points.community_pain_points;
        var emptyRes = ppAll.filter(function(pp) { return !pp.resolution || pp.resolution.trim() === ''; }).length;
        if (ppAll.length > 0 && emptyRes / ppAll.length > 0.7) { stats.resolutionWarning = emptyRes + '/' + ppAll.length + ' pain points have empty resolution'; }
    }
    if (data.human_summary && (!data.human_summary.summary_recommendation || data.human_summary.summary_recommendation.trim() === '')) { stats.summaryRecommendationEmpty = true; }
    data = updateConfidenceStatement(data, validSourcesCount);
    data = removeNulls(data);
    var profile = generateSearchProfile(data, themeName || '', taxonomyJson || '');
    if (profile) { data.search_profile = profile; stats.searchProfileGenerated = true; }
    return { json: JSON.stringify(data, null, 2), stats: stats, validSources: validSourcesCount };
}

// ============================================
// CLEANUP HELPERS
// ============================================

function isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;
    var urlTrimmed = url.trim(); var urlLower = urlTrimmed.toLowerCase();
    for (var i = 0; i < CLEANUP_CONFIG.INVALID_URL_PATTERNS.length; i++) { if (urlLower === CLEANUP_CONFIG.INVALID_URL_PATTERNS[i] || urlTrimmed === '') return false; }
    if (!urlLower.startsWith('http://') && !urlLower.startsWith('https://')) return false;
    try { var parsed = urlTrimmed.match(/^https?:\/\/([^\/]+)/); if (!parsed || !parsed[1] || parsed[1] === 'unknown' || parsed[1].length < 3) return false; } catch (e) { return false; }
    return true;
}

function isShortVerdict(text) {
    if (!text || typeof text !== 'string') return true;
    var trimmed = text.trim().toLowerCase();
    if (trimmed.length < CLEANUP_CONFIG.MIN_VERDICT_LENGTH) return true;
    for (var i = 0; i < CLEANUP_CONFIG.SHORT_VERDICT_WORDS.length; i++) { if (trimmed === CLEANUP_CONFIG.SHORT_VERDICT_WORDS[i]) return true; }
    return false;
}

function cleanShortVerdicts(data) {
    var cleared = 0;
    var sections = [
        { obj: data.handoff_difficulty, keys: ['handoff_verdict_safe','handoff_verdict_caution','handoff_verdict_avoid'] },
        { obj: data.scenario_performance, keys: ['perf_verdict_safe','perf_verdict_caution','perf_verdict_avoid'] },
        { obj: data.scenario_updates, keys: ['updates_verdict_safe','updates_verdict_caution','updates_verdict_avoid'] },
        { obj: data.plugin_compatibility_enhanced, keys: ['compat_verdict_safe','compat_verdict_caution','compat_verdict_avoid'] }
    ];
    for (var i = 0; i < sections.length; i++) {
        if (!sections[i].obj) continue;
        for (var j = 0; j < sections[i].keys.length; j++) { var key = sections[i].keys[j]; if (isShortVerdict(sections[i].obj[key])) { sections[i].obj[key] = ''; cleared++; } }
    }
    return { data: data, cleared: cleared };
}

function validatePerformanceConsistency(data) {
    var issues = [];
    if (!data.performance_metrics) { data.performance_metrics = { pagespeed_mobile:0, pagespeed_desktop:0, lcp_mobile:0, lcp_desktop:0, cls_mobile:0, cls_desktop:0, test_url:'', test_date:'', pagespeed_link:'', performance_tier:'', performance_interpretation:'' }; }
    if (!data.performance_metrics.pagespeed_link) data.performance_metrics.pagespeed_link = '';
    var metrics = data.performance_metrics; var scenario = data.scenario_performance || {};
    var mobile = metrics.pagespeed_mobile || 0; var lcpMobile = metrics.lcp_mobile || 0; var clsMobile = metrics.cls_mobile || 0;
    if (mobile <= 0) { if (data.scenario_performance) data.scenario_performance.perf_confidence = 'low'; return { data: data, issues: ['No PageSpeed data - confidence set to low'] }; }
    if (mobile < PAGESPEED_THRESHOLDS.NEEDS_WORK && scenario.perf_verdict_safe && scenario.perf_verdict_safe.length > CLEANUP_CONFIG.MIN_VERDICT_LENGTH) { issues.push('CLEARED: verdict_safe incompatible with mobile score ' + mobile); data.scenario_performance.perf_verdict_safe = ''; }
    if (mobile >= PAGESPEED_THRESHOLDS.EXCELLENT && scenario.perf_verdict_avoid) { var al = scenario.perf_verdict_avoid.toLowerCase(); if (al.indexOf('slow') !== -1 || al.indexOf('poor performance') !== -1) issues.push('CONFLICT: Excellent score ' + mobile + ' but verdict_avoid mentions slowness'); }
    var expectedTier = getPerformanceTier(mobile);
    if (expectedTier === 'excellent') {
        if (clsMobile > PAGESPEED_THRESHOLDS.CLS_POOR) { expectedTier = 'good'; issues.push('DOWNGRADED: Tier excellent→good (CLS ' + clsMobile + ' > ' + PAGESPEED_THRESHOLDS.CLS_POOR + ')'); }
        else if (lcpMobile > PAGESPEED_THRESHOLDS.LCP_POOR) { expectedTier = 'good'; issues.push('DOWNGRADED: Tier excellent→good (LCP ' + lcpMobile + 's > ' + PAGESPEED_THRESHOLDS.LCP_POOR + 's)'); }
    }
    var currentTier = metrics.performance_tier || '';
    if (currentTier && currentTier !== expectedTier) issues.push('FIXED: Tier "' + currentTier + '" → "' + expectedTier + '" (score: ' + mobile + ')');
    data.performance_metrics.performance_tier = expectedTier;
    if (!metrics.performance_interpretation || metrics.performance_interpretation.length < 20) { data.performance_metrics.performance_interpretation = generatePerformanceInterpretation(mobile, lcpMobile, clsMobile); issues.push('ADDED: Auto-generated performance interpretation'); }
    if (lcpMobile > PAGESPEED_THRESHOLDS.LCP_POOR && scenario.perf_verdict_caution && scenario.perf_verdict_caution.toLowerCase().indexOf('lcp') === -1) issues.push('WARNING: LCP ' + lcpMobile + 's poor but not in caution verdict');
    if (clsMobile > PAGESPEED_THRESHOLDS.CLS_POOR && scenario.perf_verdict_caution && scenario.perf_verdict_caution.toLowerCase().indexOf('cls') === -1 && scenario.perf_verdict_caution.toLowerCase().indexOf('layout') === -1) issues.push('WARNING: CLS ' + clsMobile + ' poor but not in caution verdict');
    if (scenario.perf_code_observation) { var obs = scenario.perf_code_observation.toLowerCase(); if (obs.indexOf(String(mobile)) === -1 && obs.indexOf('pagespeed') === -1) { data.scenario_performance.perf_code_observation = 'Mobile PageSpeed: ' + mobile + '/100. ' + scenario.perf_code_observation; issues.push('ADDED: Score to perf_code_observation'); } }
    return { data: data, issues: issues };
}

function updateConfidenceStatement(data, validSourcesCount) {
    var analyticalCount = validSourcesCount;
    if (data.sources_methodology && data.sources_methodology.sources) { analyticalCount = data.sources_methodology.sources.filter(function(s) { if (NON_ANALYTICAL_SOURCE_TYPES.indexOf(s.source_type) !== -1) return false; if (isGenericUrl(s.source_url)) return false; return true; }).length; }
    var confidence = 'LOW';
    if (analyticalCount >= 15) confidence = 'HIGH'; else if (analyticalCount >= 5) confidence = 'MEDIUM';
    if (data.sources_methodology) data.sources_methodology.confidence_statement = 'Data confidence: ' + confidence + ' (' + analyticalCount + ' analytical sources, ' + validSourcesCount + ' total)';
    if (data.handoff_difficulty) { var hs2 = data.handoff_difficulty.handoff_sources_count || 0; data.handoff_difficulty.handoff_confidence = hs2 >= 3 ? 'high' : (hs2 >= 1 ? 'medium' : 'low'); }
    if (data.scenario_performance) { var ps = data.scenario_performance.perf_sources_count || 0; var hasPG = data.performance_metrics && data.performance_metrics.pagespeed_mobile > 0; data.scenario_performance.perf_confidence = (hasPG && ps >= 2) ? 'high' : ((hasPG || ps >= 1) ? 'medium' : 'low'); }
    if (data.scenario_updates) { var us = data.scenario_updates.updates_sources_count || 0; data.scenario_updates.updates_confidence = us >= 3 ? 'high' : (us >= 1 ? 'medium' : 'low'); }
    if (data.plugin_compatibility_enhanced) { var cs = data.plugin_compatibility_enhanced.compat_sources_count || 0; data.plugin_compatibility_enhanced.compat_confidence = cs >= 3 ? 'high' : (cs >= 1 ? 'medium' : 'low'); }
    return data;
}

function removeNulls(obj) {
    if (Array.isArray(obj)) { return obj.map(function(item) { return removeNulls(item); }).filter(function(item) { return item !== null; }); }
    if (obj !== null && typeof obj === 'object') {
        var cleaned = {};
        for (var key in obj) { if (obj.hasOwnProperty(key)) { var value = removeNulls(obj[key]); if (value === null) { if (key.indexOf('score') !== -1 || key.indexOf('count') !== -1 || key.indexOf('price') !== -1 || key.indexOf('value') !== -1) cleaned[key] = 0; else if (Array.isArray(obj[key])) cleaned[key] = []; else cleaned[key] = ''; } else { cleaned[key] = value; } } }
        return cleaned;
    }
    return obj;
}

function formatCleanupStatus(stats, validSources) {
    var parts = [];
    if (stats.searchProfileGenerated) parts.push('🔍 search_profile generated');
    if (stats.sourceRefsFixed > 0 || stats.sourceOrphansRemoved > 0 || stats.sourcesAdded > 0) parts.push('🔗 walk:' + stats.sourceRefsFixed + ' fix, ' + stats.sourceOrphansRemoved + ' orphan, +' + stats.sourcesAdded + ' src');
    if (stats.idsBeforeRemap > 0) parts.push('IDs:' + stats.idsBeforeRemap + '→' + stats.idsAfterRemap);
    if (stats.pluginsRemoved > 0) parts.push('-' + stats.pluginsRemoved + ' plug');
    if (stats.companionPluginsRemoved > 0) parts.push('-' + stats.companionPluginsRemoved + ' companion');
    if (stats.stalePainPointsDegraded > 0) parts.push('⚠️ ' + stats.stalePainPointsDegraded + ' stale pain pts degraded');
    if (stats.painPointsRemoved > 0) parts.push('-' + stats.painPointsRemoved + ' pain');
    if (stats.praiseRemoved > 0) parts.push('-' + stats.praiseRemoved + ' praise');
    if (stats.praiseFallbackGenerated > 0) parts.push('+' + stats.praiseFallbackGenerated + ' praise(fb)');
    if (stats.verdictsCleared > 0) parts.push('-' + stats.verdictsCleared + ' verdict');
    if (stats.faqCleared) parts.push('FAQ cleared');
    if (stats.performanceIssues && stats.performanceIssues.length > 0) parts.push('⚠️ PERF:' + stats.performanceIssues.length);
    if (stats.bundledPluginsRemoved > 0) parts.push('-' + stats.bundledPluginsRemoved + ' bundled');
    if (stats.handoffFixed) parts.push('🔧 handoff:' + stats.handoffFixed);
    if (stats.codeQualityFixed) parts.push('🔧 cq:' + stats.codeQualityFixed);
    if (stats.painPointsWarning) parts.push('⚠️ ' + stats.painPointsWarning);
    if (stats.ratingsWarning) parts.push('⚠️ ' + stats.ratingsWarning);
    if (stats.sourceDatesInferred > 0) parts.push('📅 ' + stats.sourceDatesInferred + ' src dates inferred');
    if (stats.versionsInferred > 0) parts.push('🔢 ' + stats.versionsInferred + ' versions inferred');
    if (stats.pluginCompatDegraded > 0) parts.push('🕰️ ' + stats.pluginCompatDegraded + ' compat→previously_reported');
    if (stats.resolutionWarning) parts.push('⚠️ ' + stats.resolutionWarning);
    if (stats.summaryRecommendationEmpty) parts.push('⚠️ summary_recommendation empty');
    if (stats.quickConsStaleWarning) parts.push('⚠️ ' + stats.quickConsStaleWarning);
    var info = parts.length > 0 ? parts.join(', ') : 'no changes';
    return '✅ v3.20.3 | ' + validSources + ' src | ' + info;
}

// ============================================
// STEP RUNNERS
// ============================================

function runStep1() { var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet(); var row = sheet.getActiveRange().getRow(); if (row < 2) { SpreadsheetApp.getUi().alert('Select a data row (row 2+)'); return; } var themeName = sheet.getRange(row, COL.THEME_NAME).getValue(); var perplexity = sheet.getRange(row, COL.PERPLEXITY).getValue(); var changelog = sheet.getRange(row, COL.CHANGELOG).getValue(); var scrapedJson = sheet.getRange(row, COL.SCRAPED_JSON).getValue(); var distributionModel = getDistributionModel(scrapedJson); if (!themeName || !perplexity) { SpreadsheetApp.getUi().alert('Missing theme_name or research in column C'); return; } updateStatus(sheet, row, '⏳ Step 1 [' + distributionModel + ']...'); try { var result = callGemini(buildStep1Prompt(themeName, perplexity, distributionModel, changelog)); sheet.getRange(row, COL.STEP1_OUTPUT).setValue(result); updateStatus(sheet, row, '✅ Step 1 Done [' + distributionModel + ']'); SpreadsheetApp.getUi().alert('Step 1 Complete!\nDistribution: ' + distributionModel); } catch (error) { updateStatus(sheet, row, '❌ Step 1: ' + error.message); SpreadsheetApp.getUi().alert('Error: ' + error.message); } }

function runStep2() { var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet(); var row = sheet.getActiveRange().getRow(); if (row < 2) { SpreadsheetApp.getUi().alert('Select a data row'); return; } var themeName = sheet.getRange(row, COL.THEME_NAME).getValue(); var scrapedJson = sheet.getRange(row, COL.SCRAPED_JSON).getValue(); var step1Output = sheet.getRange(row, COL.STEP1_OUTPUT).getValue(); var distributionModel = getDistributionModel(scrapedJson); if (!step1Output) { SpreadsheetApp.getUi().alert('Run Step 1 first!'); return; } updateStatus(sheet, row, '⏳ Step 2 [' + distributionModel + ']...'); try { var result = callGemini(buildStep2Prompt(themeName, scrapedJson, step1Output, distributionModel)); sheet.getRange(row, COL.STEP2_OUTPUT).setValue(result); updateStatus(sheet, row, '✅ Step 2 Done [' + distributionModel + ']'); SpreadsheetApp.getUi().alert('Step 2 Complete!'); } catch (error) { updateStatus(sheet, row, '❌ Step 2: ' + error.message); SpreadsheetApp.getUi().alert('Error: ' + error.message); } }

function runStep3() { var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet(); var row = sheet.getActiveRange().getRow(); if (row < 2) { SpreadsheetApp.getUi().alert('Select a data row'); return; } var themeName = sheet.getRange(row, COL.THEME_NAME).getValue(); var scrapedJson = sheet.getRange(row, COL.SCRAPED_JSON).getValue(); var step1Output = sheet.getRange(row, COL.STEP1_OUTPUT).getValue(); var step2Output = sheet.getRange(row, COL.STEP2_OUTPUT).getValue(); var taxonomyJson = sheet.getRange(row, COL_TAXONOMY).getValue(); var distributionModel = getDistributionModel(scrapedJson); if (!step1Output || !step2Output) { SpreadsheetApp.getUi().alert('Run Step 1 and 2 first!'); return; } updateStatus(sheet, row, '⏳ Step 3 [' + distributionModel + ']...'); try { var rawResult = callGemini(buildStep3Prompt(themeName, scrapedJson, step1Output, step2Output, distributionModel), true); sheet.getRange(row, COL.DEBUG_RAW).setValue(rawResult); updateStatus(sheet, row, '🧹 Cleaning...'); var changelog = sheet.getRange(row, COL.CHANGELOG).getValue(); var cleanupResult = cleanupOutput(rawResult, themeName, taxonomyJson, changelog); sheet.getRange(row, COL.STEP3_OUTPUT).setValue(cleanupResult.json); updateStatus(sheet, row, formatCleanupStatus(cleanupResult.stats, cleanupResult.validSources)); var msg = 'Step 3 Complete!\n\nDistribution: ' + distributionModel + '\nSources: ' + cleanupResult.validSources + '\nRefs fixed: ' + cleanupResult.stats.sourceRefsFixed + '\nOrphans removed: ' + cleanupResult.stats.sourceOrphansRemoved + '\nsearch_profile: ' + (cleanupResult.stats.searchProfileGenerated ? '✅' : '⚠️ empty'); if (cleanupResult.stats.companionPluginsRemoved > 0) msg += '\nCompanion plugins removed: ' + cleanupResult.stats.companionPluginsRemoved; if (cleanupResult.stats.stalePainPointsDegraded > 0) msg += '\nStale pain points degraded: ' + cleanupResult.stats.stalePainPointsDegraded; if (cleanupResult.stats.handoffFixed) msg += '\nHandoff: ' + cleanupResult.stats.handoffFixed; if (cleanupResult.stats.performanceIssues.length > 0) msg += '\n\nPerf fixes:\n• ' + cleanupResult.stats.performanceIssues.join('\n• '); SpreadsheetApp.getUi().alert(msg); } catch (error) { updateStatus(sheet, row, '❌ Step 3: ' + error.message); SpreadsheetApp.getUi().alert('Error: ' + error.message); } }

function runAllSteps() { var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet(); var row = sheet.getActiveRange().getRow(); if (row < 2) { SpreadsheetApp.getUi().alert('Select a data row'); return; } var ui = SpreadsheetApp.getUi(); var confirm = ui.alert('Run All Steps', 'Run all 3 steps for this theme?', ui.ButtonSet.YES_NO); if (confirm !== ui.Button.YES) return; try { var themeName = sheet.getRange(row, COL.THEME_NAME).getValue(); var perplexity = sheet.getRange(row, COL.PERPLEXITY).getValue(); var changelog = sheet.getRange(row, COL.CHANGELOG).getValue(); var scrapedJson = sheet.getRange(row, COL.SCRAPED_JSON).getValue(); var taxonomyJson = sheet.getRange(row, COL_TAXONOMY).getValue(); var distributionModel = getDistributionModel(scrapedJson); updateStatus(sheet, row, '⏳ Step 1/3 [' + distributionModel + ']...'); var step1Result = callGemini(buildStep1Prompt(themeName, perplexity, distributionModel, changelog)); sheet.getRange(row, COL.STEP1_OUTPUT).setValue(step1Result); Utilities.sleep(1000); updateStatus(sheet, row, '⏳ Step 2/3 [' + distributionModel + ']...'); var step2Result = callGemini(buildStep2Prompt(themeName, scrapedJson, step1Result, distributionModel)); sheet.getRange(row, COL.STEP2_OUTPUT).setValue(step2Result); Utilities.sleep(1000); updateStatus(sheet, row, '⏳ Step 3/3 [' + distributionModel + ']...'); var rawResult = callGemini(buildStep3Prompt(themeName, scrapedJson, step1Result, step2Result, distributionModel), true); sheet.getRange(row, COL.DEBUG_RAW).setValue(rawResult); updateStatus(sheet, row, '🧹 Cleaning...'); var cleanupResult = cleanupOutput(rawResult, themeName, taxonomyJson, changelog); sheet.getRange(row, COL.STEP3_OUTPUT).setValue(cleanupResult.json); updateStatus(sheet, row, formatCleanupStatus(cleanupResult.stats, cleanupResult.validSources)); ui.alert('All steps complete! [' + distributionModel + ']' + '\nSources: ' + cleanupResult.validSources + '\nRefs fixed: ' + cleanupResult.stats.sourceRefsFixed + '\nOrphans: ' + cleanupResult.stats.sourceOrphansRemoved + (cleanupResult.stats.companionPluginsRemoved > 0 ? '\nCompanion plugins removed: ' + cleanupResult.stats.companionPluginsRemoved : '') + (cleanupResult.stats.stalePainPointsDegraded > 0 ? '\nStale pain points degraded: ' + cleanupResult.stats.stalePainPointsDegraded : '') + '\nsearch_profile: ' + (cleanupResult.stats.searchProfileGenerated ? '✅' : '⚠️ empty (run Assign Taxonomies + Re-run Cleanup)')); } catch (error) { updateStatus(sheet, row, '❌ Error: ' + error.message); SpreadsheetApp.getUi().alert('Error: ' + error.message); } }

function rerunCleanup() { var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet(); var row = sheet.getActiveRange().getRow(); if (row < 2) { SpreadsheetApp.getUi().alert('Select a data row'); return; } var rawOutput = sheet.getRange(row, COL.DEBUG_RAW).getValue(); if (!rawOutput) { SpreadsheetApp.getUi().alert('No raw output in column I. Run Step 3 first.'); return; } var themeName = sheet.getRange(row, COL.THEME_NAME).getValue(); var taxonomyJson = sheet.getRange(row, COL_TAXONOMY).getValue(); var changelog = sheet.getRange(row, COL.CHANGELOG).getValue(); try { var cleanupResult = cleanupOutput(rawOutput, themeName, taxonomyJson, changelog); sheet.getRange(row, COL.STEP3_OUTPUT).setValue(cleanupResult.json); updateStatus(sheet, row, formatCleanupStatus(cleanupResult.stats, cleanupResult.validSources)); SpreadsheetApp.getUi().alert('Cleanup re-applied!\nSources: ' + cleanupResult.validSources + '\nRefs fixed: ' + cleanupResult.stats.sourceRefsFixed + '\nOrphans: ' + cleanupResult.stats.sourceOrphansRemoved + (cleanupResult.stats.companionPluginsRemoved > 0 ? '\nCompanion plugins removed: ' + cleanupResult.stats.companionPluginsRemoved : '') + (cleanupResult.stats.stalePainPointsDegraded > 0 ? '\nStale pain points degraded: ' + cleanupResult.stats.stalePainPointsDegraded : '') + '\nsearch_profile: ' + (cleanupResult.stats.searchProfileGenerated ? '✅' : '⚠️ empty')); } catch (error) { SpreadsheetApp.getUi().alert('Cleanup error: ' + error.message); } }

// ============================================
// PROMPTS
// ============================================

function buildStep1Prompt(themeName, perplexityResearch, distributionModel, changelog) { var scopeInstruction = '## PRODUCT SCOPE (CRITICAL)\nMany WordPress themes have companion plugins (e.g. Kadence Theme + Kadence Blocks, Blocksy + Blocksy Companion, OceanWP + Ocean Extra).\nYou MUST tag every pain point and praise point with ONE scope label:\n- `[THEME]` — issue is specific to the base theme (customizer, theme options, header/footer templates, theme code)\n- `[BLOCKS]` — issue is specific to a companion blocks/pro plugin (block editor bugs, custom blocks, pro features, editor extensions)\n- `[ECOSYSTEM]` — issue affects integration between theme and its plugins, or scope is genuinely unclear\n\nSCOPE ASSIGNMENT RULES:\n- Customizer, theme options, header/footer builder within theme → [THEME]\n- Block editor bugs, custom blocks, block styling issues → [BLOCKS]\n- If source explicitly names a companion plugin (e.g. "Kadence Blocks", "Blocksy Companion", "Ocean Extra") → [BLOCKS]\n- If source says just the theme name with no qualifier → [THEME] (default)\n- "After updating everything broke" (no specifics) → [ECOSYSTEM]\n- Plugin compatibility (e.g. WooCommerce conflict) → assign to whichever product the conflict is with\n- If theme has NO known companion plugins, tag everything [THEME]\n- IMPORTANT: [BLOCKS] means specifically the companion BLOCKS plugin (e.g. Kadence Blocks, Blocksy Companion). Other companion plugins like Starter Templates, Email Customizers, or Pro addons are [ECOSYSTEM], not [BLOCKS].\n- Only use [BLOCKS] if the issue specifically involves the block editor, custom blocks, or the blocks plugin by name.\n\n'; var dateInstruction = '## DATE ENFORCEMENT (CRITICAL)\nFor EVERY source in the Sources Index, extract the publication date:\n- Format: YYYY-MM (e.g., 2025-11, 2026-02)\n- Look for: post date, thread date, article publication date, changelog entry date\n- If date cannot be determined, mark as "date-unknown"\n\nDATE-BASED RULES:\n- Sources older than 6 months: tag as [HISTORICAL] in the Sources Index\n- Pain points supported ONLY by [HISTORICAL] sources: severity capped at "moderate" and append "(historical — unconfirmed current)" to title\n- Pain points from the last 3 months: full weight\n- Pain points from 3-6 months ago: normal weight\n- Pain points older than 6 months: include ONLY if critical severity and no resolution found in changelog\nIMPORTANT: WordPress.org support topics, Reddit posts, and blog articles ALWAYS have visible publication dates. "date-unknown" is acceptable ONLY for documentation pages, changelogs, and official product pages without timestamps. If you mark a forum post or Reddit thread as "date-unknown", you are making an error.\n\n'; var severityInstruction = '## SEVERITY CALIBRATION\n- CRITICAL = site down, data loss, or security vulnerability affecting majority of users. Requires multiple independent confirmations.\n- MAJOR = significant functionality broken, documented workaround exists. Confirmed by 2+ sources.\n- MODERATE = inconvenience, affects specific configurations. Can be single-source if well-documented.\n- MINOR = cosmetic, edge case, single user report without confirmation.\n\nA single user report without confirmation is NEVER critical.\nEnvironment-specific issues (one hosting provider, one server config) are maximum MODERATE.\n- Issues specific to ONE hosting provider (Hostinger, Azure, etc.) are maximum MODERATE regardless of impact.\n- Issues from a SINGLE user report with no independent confirmation are maximum MODERATE.\n- An official troubleshooting guide existing for an issue does NOT elevate its severity — it means the vendor is aware, not that the issue is critical.\n\n'; var changelogInput = ''; if (changelog && changelog.trim().length > 20) { changelogInput = '### CHANGELOG DATA (last 6 months):\nUse this to VERIFY community reports. If a pain point was fixed in a changelog entry, note the fix version and mark resolution.\nIf changelog shows active development (frequent releases), this is a positive signal for updates praise.\n\n' + changelog + '\n\n'; } else { changelogInput = '### CHANGELOG DATA: No changelog provided.\n\n'; } return '# STEP 1: COMMUNITY ANALYSIS\n## WPAgent Data Pipeline v3.20.1\n\n' + 'Analyze community feedback for WordPress theme "' + themeName + '".\n\n' + getDistributionModelInstructions(distributionModel) + scopeInstruction + dateInstruction + severityInstruction + '## RULES:\n' + '1. ONLY EXTRACT data from provided research\n' + '2. CITE with [ID] format\n' + '3. Only include sources with REAL URLs (https://...)\n' + '4. Output in ENGLISH\n' + '5. MINIMUM 8 PAIN POINTS required - dig deep into ALL sources\n' + '6. If fewer than 8 issues found, explicitly note: "Limited negative feedback in sources - found X issues"\n' + '7. COMPLETE SOURCE INDEX: Every URL you reference ANYWHERE must appear in the Sources Index table\n' + '8. SOURCE URL SPECIFICITY (CRITICAL): Every source_url MUST link to a SPECIFIC page, article, or thread — NOT a homepage or domain root.\n' + '   ❌ BAD: https://wpscan.com, https://www.reddit.com/r/Wordpress/, https://www.wordfence.com\n' + '   ✅ GOOD: https://wpscan.com/vulnerability/abc123, https://www.reddit.com/r/Wordpress/comments/xyz/title/, https://www.wordfence.com/blog/2024/02/report-name/\n' + '   If you cannot find a specific URL for a claim, note it as "source URL unavailable" and do NOT use a generic homepage.\n\n' + '## INPUT:\n\n### COMMUNITY RESEARCH:\n' + perplexityResearch + '\n\n' + changelogInput + '## OUTPUT STRUCTURE:\n\n' + '### 1. SOURCES INDEX\n**CRITICAL: This table MUST contain EVERY URL referenced in this document.**\n**Every [ID] used below MUST have a row in this table.**\n\n' + '| ID | Source Name | Full URL | Type | Date | Historical? |\n|----|-------------|----------|------|------|-------------|\n\nTypes: forum, review_site, official, social, marketplace, documentation, changelog\nDate: YYYY-MM (or "date-unknown")\nHistorical: YES if older than 6 months, otherwise NO\n\n' + '### 2. PAIN POINTS (MINIMUM 8 REQUIRED)\n' + '| Scope | Category | Issue | Quote | [ID] | Severity | Frequency | Theme Version | Date Reported |\n' + '|-------|----------|-------|-------|------|----------|-----------|---------------|---------------|\n\n' + 'Scope: [THEME], [BLOCKS], [ECOSYSTEM]\nCategories: performance, handoff, updates, plugin_compat, support, cost, general\nSeverity: critical, major, moderate, minor (follow SEVERITY CALIBRATION rules above)\nDate Reported: YYYY-MM from source (or "date-unknown")\n\n' + 'Theme Version = version of the theme mentioned in the source thread/article.\nExtract from context clues: "I updated to 8.2.6 and...", "using v7.5", "after latest update (8.3)".\nIf no version mentioned, write "unknown".\n\nCHANGELOG CROSS-REFERENCE: If changelog data is provided, check if any pain point was addressed in a release. If yes, set resolution to "Fixed in vX.Y.Z" and consider downgrading severity.\n\nVERSION EXTRACTION PRIORITY:\n1. If source explicitly mentions a version ("v8.2.6", "after updating to 1.4") → use that version\n2. If source has a date and changelog is provided → find the theme version active on that date from changelog\n3. If pain point was FIXED in changelog → set version_reported to the version BEFORE the fix\n4. "unknown" is a last resort, not a default. Try steps 1-3 first.\n\nIMPORTANT: Extract ALL issues mentioned, even minor ones. Target 8-15 pain points.\nLook for: bugs, complaints, workarounds, frustrations, limitations, conflicts.\n\n' + '### 3. PRAISE POINTS (MINIMUM 3 REQUIRED — treat as seriously as pain points)\n' + 'Actively search ALL sources for positive mentions. Every theme has strengths — find them.\nLook in: official marketing, community forums, reviews, comparison articles, Reddit threads.\nEven pain point sources often contain praise ("despite X, the theme excels at Y").\n\n' + '| Scope | Category | Positive Aspect | Quote/Evidence | [ID] | Frequency |\n' + '|-------|----------|----------------|----------------|------|-----------|\n\n' + 'Categories: performance, security, plugin_compat, handoff, updates, support, development, community, marketplace\nFrequency: frequent, common, occasional, verified\n\n' + 'EXTRACTION GUIDE — look for these signals:\n' + '- Performance: fast loading, clean code, low bloat, good CWV, "lightweight"\n' + '- Development: granular control, clean output, developer-friendly, good API\n' + '- Plugin compat: "works great with ACF", "best Woo integration", native support\n' + '- Community: active forums, helpful community, fast peer support\n' + '- Security: fast patching, responsible disclosure, proactive security\n' + '- Support: responsive team, quality documentation, video tutorials\n' + '- Updates: frequent releases, transparent changelog, backward compatibility\n' + '- Marketplace: high ratings, growing sales, trusted by agencies\n\n' + 'CHANGELOG PRAISE: If changelog shows frequent releases (monthly+), active bugfixing, or security responsiveness — extract as updates/security praise.\n\n' + 'RULES:\n' + '- MINIMUM 3 praise points with valid source URLs — this is a HARD requirement like 8 pain points\n' + '- If fewer than 3 found, explicitly note: "Limited positive feedback in sources — found X praise points"\n' + '- DO NOT skip praise just because you found many pain points — balance matters\n' + '- Each praise point MUST have a specific [ID] source reference\n\n' + '### 4. SIGNALS\n\n#### HANDOFF:\n- Panel complexity: "{quote}" [ID]\n- Learning curve: "{quote}" [ID]\n\n' + '#### COMPATIBILITY:\n- {Plugin}: {status} — "{evidence}" [ID]\nStatus: full, partial, limited, none\n\n' + '#### PERFORMANCE:\n- Speed: {positive/negative/mixed} — "{evidence}" [ID]\n\n' + '#### UPDATES:\n- Breaking changes: {yes/no} — "{evidence}" [ID]\n- Changelog frequency: {weekly/monthly/quarterly/sporadic} (from changelog data if provided)\n\n' + '### 5. BUNDLED PLUGINS\n| Plugin | Category | [ID] |\n|--------|----------|----- |\n\n' + '### 6. FAQ CANDIDATES\n5-8 questions answerable from data above.\n\n' + '### 7. SCOPE SUMMARY\nPain points breakdown: X [THEME], Y [BLOCKS], Z [ECOSYSTEM]\nPraise breakdown: X [THEME], Y [BLOCKS], Z [ECOSYSTEM]\n\n' + '### 8. STATS\nTotal sources with URLs: X\nPain points extracted: X (minimum 8 required)\nPraise points extracted: X (minimum 3 required)\nHistorical sources (>6mo): X\nChangelog entries analyzed: X\nConfidence: HIGH/MEDIUM/LOW\n\n' + '### 9. SOURCE INTEGRITY CHECK\nList any [ID] used in the document above that is NOT in the Sources Index: (should be NONE)\n'; }

function buildStep2Prompt(themeName, scrapedJson, step1Output, distributionModel) { return '# STEP 2: VERDICT SYNTHESIS\n## WPAgent Data Pipeline v3.20.1\n\n' + 'Synthesize verdicts for "' + themeName + '".\n\n' + getDistributionModelInstructions(distributionModel) + '## SEVERITY CALIBRATION (RE-VERIFY Step 1 ASSESSMENTS)\nBefore synthesizing verdicts, verify Step 1 severity assignments:\n- CRITICAL = site down, data loss, or security vulnerability affecting majority of users. Multiple independent confirmations required.\n- MAJOR = significant functionality broken, documented workaround exists. Confirmed by 2+ sources.\n- MODERATE = inconvenience, affects specific configurations. Can be single-source if well-documented.\n- MINOR = cosmetic, edge case, single user report.\n\nDOWNGRADE if Step 1 over-assigned:\n- Single user report marked critical → downgrade to moderate at most\n- Environment-specific issue marked major → downgrade to moderate\n- Issues tagged "(historical — unconfirmed current)" → do NOT drive current verdicts\n- Issues with scope [BLOCKS] or [ECOSYSTEM] → note separately, do not inflate theme verdicts\n\n' + '## SCOPE-AWARE SYNTHESIS\nStep 1 pain points are tagged [THEME], [BLOCKS], or [ECOSYSTEM].\n- Verdicts in handoff, performance, updates sections: focus on [THEME] issues\n- [BLOCKS] issues: note separately as "Companion plugin note: ..."\n- [ECOSYSTEM] issues: attribute clearly as "Ecosystem integration: ..."\n- In QUICK OVERVIEW: mention scope split, e.g. "X of Y reported issues affect the theme directly; Z relate to companion plugins."\n\n' + '## CRITICAL RULES:\n1. Use [ID] in technical sections\n2. NO [ID] in Quick Verdict and Human Summary\n3. Use ACF enum values exactly\n4. ONLY use [ID] numbers that exist in Step 1 Sources Index\n\n' + '## VERDICT RULES (VERY IMPORTANT):\n- Each verdict_safe, verdict_caution, verdict_avoid MUST be a FULL SENTENCE\n- Minimum 20 words per verdict\n- NEVER write just "Safe", "Caution", or "Avoid"\n- If no data available, leave the field EMPTY\n\n' + '## ACF ENUMS:\n- panel_complexity: minimal | moderate | complex | overwhelming\n- docs_quality: excellent | good | basic | poor\n- learning_curve: minutes | hours | days | weeks\n- code_quality: basic | good | high | premium\n- compatibility_status: full | partial | limited | none\n- severity: critical | major | moderate | minor\n- performance_tier: excellent | good | needs_work | poor\n\n' + '## PAGESPEED INTERPRETATION:\n### Mobile Score Tiers:\n- 90-100: EXCELLENT | 70-89: GOOD | 50-69: NEEDS_WORK | 0-49: POOR\n\n### Core Web Vitals:\n- LCP ≤2.5s: Good | 2.5-4s: Needs improvement | >4s: Poor\n- CLS ≤0.1: Good | 0.1-0.25: Needs improvement | >0.25: Poor\n\n' + '### PAGESPEED RULES:\n1. If pagespeed_data exists, USE IT as PRIMARY source\n2. Community feedback is SECONDARY\n3. If mobile < 50, perf_verdict_safe MUST be EMPTY\n4. If mobile >= 90, perf_verdict_avoid should NOT mention slowness\n5. Always state score in perf_code_observation\n\n' + '## PRICING RULES:\n- money_back_guarantee: Number of days. Research from official website.\n  Common values: ThemeForest=0, Elegant Themes=30, ThemeIsle=30, Starter Templates=14, Flavor=30.\n  If unknown, set to 0.\n- ALWAYS check the author official pricing/FAQ page for refund policy.\n\n' + '## RATINGS RULES:\n- ALWAYS populate external_ratings with at least 1 entry.\n- For wordpress_org themes: use WordPress.org rating (stars + review count).\n- For themeforest themes: use ThemeForest rating.\n- Also include G2, Trustpilot, or Capterra if found.\n- rating_url MUST be direct link to the review page.\n\n' + '## INPUT:\n\n### Scraped JSON:\n' + (scrapedJson || '{}') + '\n\n### Step 1 Community Analysis:\n' + step1Output + '\n\n' + '## OUTPUT:\n\n### 1. QUICK OVERVIEW\n**Quick Verdict:** (2-3 sentences, NO [ID]. Mention scope: "X of Y reported issues affect the theme directly.")\n**Pros:** (3 items, max 60 chars)\n**Cons:** (3 items, max 60 chars)\n\n' + '### 2. HANDOFF\nPanel Complexity: [enum]\nDocs Quality: [enum]\nLearning Curve: [enum]\n' + 'NOTE: handoff_score calculated automatically from enums.\nSCALE: 10 = easiest handoff (minimal panel, excellent docs, minutes to learn).\n       1 = hardest handoff (overwhelming panel, poor docs, weeks to learn).\n' + 'CONSISTENCY: If learning_curve=weeks, panel MUST be complex or overwhelming.\n             If learning_curve=minutes, panel MUST be minimal or moderate.\n' + 'Confidence: low|medium|high\nSources Count: X\n\nVerdicts (full sentences, 20+ words):\n- Safe if: ...\n- Caution if: ...\n- Avoid if: ...\n\nRecommendation: ...\nAlternatives: ...\n\n' + '### 3. PERFORMANCE\nConfidence: low|medium|high\nSources Count: X\n\n**PageSpeed Data (from scraped JSON):**\nMap fields: lcp_score→lcp_mobile, cls_score→cls_mobile, tested_url→test_url\n\n' + 'Code Observation: "Mobile PageSpeed [X]/100 tested on [url] on [date]. [interpretation]"\n\nVerdicts (aligned with scores):\n- Safe if: ...\n- Caution if: ...\n- Avoid if: ...\n\nRecommendation: ...\nAlternatives: ...\n\n' + '### 4. UPDATES\nConfidence: ...\nSources Count: ...\nVerdicts:\n- Safe if: ...\n- Caution if: ...\n- Avoid if: ...\n\nRecommendation: ...\nAlternatives: ...\n\n' + '### 5. PLUGIN COMPATIBILITY\n\n' + '## PAIN POINT CROSS-REFERENCE (MANDATORY — DO THIS FIRST):\n' + 'Before writing the plugin list, scan ALL pain points from Step 1 and identify every plugin mentioned.\nEVERY plugin named in a pain point MUST appear in plugin_compatibility_list.\nIf a pain point mentions "ACF Pro TypeError" → ACF Pro must be in the list.\nIf a pain point mentions "WooCommerce mini-cart conflict" → WooCommerce must be in the list.\nUse the pain point severity/description to set the correct compatibility_status:\n  critical/major pain point → partial or none\n  minor/moderate → partial\n  no pain points → full\n\n' + 'INCLUDE in the list:\n  - ALL plugins identified in the pain point cross-reference (see above)\n  - ALL other plugins mentioned anywhere in Step 1 or research data\n' + '  - Even if the only available information is a workaround or a single conflict report\n  - WooCommerce: always include — document real compatibility_status based on pain points\n\n' + 'EXCLUDE from the list:\n  - Plugins that REQUIRE this theme to function (companion/extension plugins\n' + '    whose name begins with the theme name, e.g. "' + (themeName || 'ThemeName') + ' Footer Text",\n' + '    "' + (themeName || 'ThemeName') + ' Powerpack", "' + (themeName || 'ThemeName') + ' Companion")\n' + '  - Plugins already declared in bundled_plugins\n  - PHP versions or server software\n\n' + 'PAGE BUILDER RULE: If theme officially supports/bundles Elementor, WPBakery, Divi, Bricks or Beaver Builder,\nthat builder MUST appear in plugin_compatibility_list with correct status:\n' + '  full = bundled or officially supported without issues\n  partial = supported but known conflicts exist\n  none = officially incompatible\n' + 'REASON: pipeline reads plugin_compatibility_list to generate builder tags in search_profile.\nMissing builder entry = builder tag missing = wrong search results for users.\n\n' + 'Verdicts:\n- Safe if: ...\n- Caution if: ...\n- Avoid if: ...\n\nPlugin List:\n| Plugin | Category | Status | Notes | Issue [IDs] |\n|--------|----------|--------|-------|-------------|\n\n' + '### 6. FAQ\nRefined answers with [ID] citations.\n\n### 7. BUNDLED PLUGINS\n| Plugin | Category | Value USD | License |\n|--------|----------|-----------|--------|\n\n' + '### 8. HUMAN SUMMARY\n3 paragraphs, NO [ID], NO specific metrics.\nIf theme has companion plugins with reported issues, 3rd paragraph should note: "Some community reports relate to companion plugins rather than the base theme."\n\n### 9. SOURCES\nCopy ALL sources from Step 1 — do NOT remove any.\n\n' + '### 10. PRAISE EXTRACTION (CRITICAL)\n' + 'Step 2 MUST preserve ALL praise points from Step 1 — do NOT drop them.\nIf Step 1 has fewer than 3 praise points, actively extract more from:\n  - Performance data (excellent PageSpeed → praise)\n  - Plugin compatibility (strong integration → praise)\n  - Security response (fast patching → praise)\n  - Community feedback (active forum, helpful users → praise)\nMINIMUM 3 praise points in final output. This is not optional.'; }

function buildStep3Prompt(themeName, scrapedJson, step1Output, step2Output, distributionModel) { return '# STEP 3: JSON FORMATTER\n## WPAgent v3.20.1 — WordPress Import Format\n\n' + getDistributionModelInstructions(distributionModel) + '## CRITICAL:\n' + '1. Output ONLY valid JSON\n2. NO markdown, NO explanation\n3. Use [1], [2] format for IDs\n' + '4. NO [ID] in quick_verdict, summary_paragraphs\n5. NO null values — use "" or 0\n6. Gutenberg format for summary_paragraphs\n' + '7. ALL verdict fields MUST be full sentences (20+ words) or empty string\n' + '8. performance_metrics MUST be populated from pagespeed_data if available\n9. performance_tier MUST match pagespeed_mobile score\n' + '10. Map input fields: lcp_score→lcp_mobile, cls_score→cls_mobile, tested_url→test_url, pagespeed_insights_link→pagespeed_link\n' + '11. handoff_score: Set to 0 - calculated automatically in post-processing\n' + '12. SOURCE INTEGRITY (CRITICAL):\n    a. The sources array MUST contain EVERY URL referenced anywhere in the JSON\n' + '    b. Every [N] in any field (source, user_issues, faq_answer) MUST have matching entry in sources\n' + '    c. Every community_pain_point source_url MUST appear in sources array\n    d. Use consecutive numbering [1],[2],[3]... with NO gaps\n' + '    e. Copy ALL sources from Step 1/Step 2 — do NOT drop any\n    f. Post-processing will fix numbering, but sources MUST be COMPLETE\n' + '13. distribution_model MUST be set to "' + (distributionModel || 'themeforest') + '"\n' + '14. search_profile: Leave as empty string "" — generated automatically in post-processing\n' + '15. PLUGIN COMPAT INTEGRITY: plugin_compatibility_list in output MUST include every plugin\n' + '    that appears in community_pain_points. If a pain point names a plugin, that plugin\n' + '    must have an entry in plugin_compatibility_list. Do not drop any entries from Step 2.\n' + '16. version_reported: For each community_pain_point, include the theme version from the\n' + '    source thread/article. Use "unknown" if not mentioned in the source.\n' + '17. community_praise_stats: MUST contain at least 3 entries from Step 1/Step 2 praise.\n' + '    Each entry needs: category, positive_aspect, strength, title, description, source, source_url.\n' + '    Do NOT output an empty praise array if Step 1/Step 2 contain praise points.\n' + '18. scope: For each community_pain_point and community_praise_stat, set to "theme", "blocks", or "ecosystem" based on Step 1 [THEME]/[BLOCKS]/[ECOSYSTEM] tags. Default: "theme".\n' + '19. date_reported: For each community_pain_point, set YYYY-MM from Step 1 Date Reported column. Use "date-unknown" if not available.\n' + '20. source_date: For each source in sources array, set YYYY-MM from Step 1 Sources Index Date column.\n' + '21. source_date ENFORCEMENT: Every source in the sources array MUST have source_date populated. Extract from Step 1 Sources Index Date column. This field is MANDATORY — do not leave it empty.\n' + '22. community_timeframe MUST be set to "Last 6 months" — this is the analysis window.\n\n' + '## GUTENBERG FORMAT:\n"summary_paragraphs": [\n  "<!-- wp:paragraph -->\\n<p>Text.</p>\\n<!-- /wp:paragraph -->"\n]\n\n' + '## INPUT:\n\n### Scraped JSON:\n' + (scrapedJson || '{}') + '\n\n### Step 1:\n' + step1Output + '\n\n### Step 2:\n' + step2Output + '\n\n' + '## JSON SCHEMA:\n\n' + getJsonSchema() + '\n\nOutput JSON:'; }

function getJsonSchema() { return '{\n  "quick_overview": {\n    "quick_verdict": "string (NO [ID])",\n    "quick_pros": [{"pro_text": "string max 60 chars"}],\n    "quick_cons": [{"con_text": "string max 60 chars"}]\n  },\n  "theme_basic": {\n    "theme_author": "string", "theme_version": "string", "release_date": "YYYY-MM-DD or empty",\n    "last_update": "YYYY-MM-DD", "code_quality": "basic|good|high|premium",\n    "theme_tagline": "string", "sales_count": "string", "distribution_model": "wordpress_org|themeforest|direct_sale", "demo_url": "URL"\n  },\n  "performance_metrics": {\n    "pagespeed_mobile": 0, "pagespeed_desktop": 0, "lcp_mobile": 0, "lcp_desktop": 0,\n    "cls_mobile": 0, "cls_desktop": 0,\n    "test_url": "URL", "test_date": "YYYY-MM-DD", "pagespeed_link": "URL to report",\n    "performance_tier": "excellent|good|needs_work|poor", "performance_interpretation": "string"\n  },\n  "theme_pricing": {\n    "license_type": "free|freemium|standard_commercial|subscription_based",\n    "pricing_model": "free|one_time_purchase|annual_subscription|lifetime_license",\n    "base_price": 0, "support_period_included": 6, "support_renewal_cost": 0,\n    "update_policy": "lifetime_updates|support_period_updates|major_updates_paid|subscription_only|no_updates",\n    "money_back_guarantee": 0,\n    "pricing_tiers": [{"tier_name":"","tier_price":0,"tier_description":""}]\n  },\n  "theme_ratings": {\n    "popularity_trend": "growing|stable|declining",\n    "external_ratings": [{ "rating_source": "string", "rating_score": 0, "rating_count": 0, "rating_url": "URL" }]\n  },\n  "theme_technical": {\n    "min_wp_version": "string", "min_php_version": "string", "wp_compatibility": "string",\n    "last_verification": "YYYY-MM-DD", "activity_status": "active|outdated|discontinued"\n  },\n  "handoff_difficulty": {\n    "handoff_score": 0, "handoff_panel_complexity": "minimal|moderate|complex|overwhelming",\n    "handoff_docs_quality": "excellent|good|basic|poor", "handoff_learning_curve": "minutes|hours|days|weeks",\n    "handoff_recommendation": "string", "handoff_confidence": "low|medium|high", "handoff_sources_count": 0,\n    "handoff_verdict_safe": "FULL SENTENCE 20+ words or empty", "handoff_verdict_caution": "FULL SENTENCE 20+ words or empty",\n    "handoff_verdict_avoid": "FULL SENTENCE 20+ words or empty", "handoff_alternative_themes": "string"\n  },\n  "scenario_performance": {\n    "perf_confidence": "low|medium|high", "perf_sources_count": 0,\n    "perf_verdict_safe": "FULL SENTENCE or EMPTY if mobile<50",\n    "perf_verdict_caution": "FULL SENTENCE or empty", "perf_verdict_avoid": "FULL SENTENCE or empty",\n    "perf_code_observation": "MUST include actual PageSpeed score",\n    "perf_recommendation": "string", "perf_alternative_themes": "string"\n  },\n  "scenario_updates": {\n    "updates_confidence": "low|medium|high", "updates_sources_count": 0,\n    "updates_verdict_safe": "FULL SENTENCE or empty", "updates_verdict_caution": "FULL SENTENCE or empty",\n    "updates_verdict_avoid": "FULL SENTENCE or empty", "updates_recommendation": "string", "updates_alternative_themes": "string"\n  },\n  "plugin_compatibility_enhanced": {\n    "compat_total_tested": 0, "compat_full_compatible": 0, "compat_issues_found": 0,\n    "compat_confidence": "low|medium|high", "compat_sources_count": 0,\n    "compat_verdict_safe": "FULL SENTENCE or empty", "compat_verdict_caution": "FULL SENTENCE or empty", "compat_verdict_avoid": "FULL SENTENCE or empty",\n    "compat_recommendation": "string", "compat_alternative_themes": "string",\n    "plugin_compatibility_list": [{ "plugin": "string", "plugin_category": "page_builder|ecommerce|seo|forms|caching|multilingual|other",\n      "compatibility_status": "full|partial|limited|none", "compatibility_notes": "string", "user_issues": ["[1]"] }]\n  },\n  "community_pain_points": {\n    "community_total_discussions": 0, "community_analysis_date": "YYYY-MM-DD",\n    "community_timeframe": "Last 6 months", "community_methodology_note": "string",\n    "community_pain_points": [{\n      "category": "performance|handoff|updates|plugin_compat|support|cost|general", "sentiment": "negative",\n      "source": "Source Name [N]", "source_url": "URL", "severity": "critical|major|moderate|minor",\n      "frequency": "string", "title": "string", "description": "string", "resolution": "string",\n      "version_reported": "string (theme version from source, e.g. 8.2.6, or unknown)",\n      "scope": "theme|blocks|ecosystem",\n      "date_reported": "YYYY-MM or date-unknown"\n    }],\n    "community_praise_stats": [{\n      "scope": "theme|blocks|ecosystem",\n      "category": "performance|security|plugin_compat|handoff|updates|support|development|community|marketplace",\n      "sentiment": "positive",\n      "positive_aspect": "string", "strength": "string", "title": "string",\n      "description": "string", "frequency": "frequent|common|occasional|verified",\n      "percentage": 0, "source": "Source Name [N]", "source_url": "URL"\n    }]\n  },\n  "faq": {\n    "faq_items": [{ "faq_question": "string", "faq_answer": "string with [N]",\n      "faq_category": "compatibility|performance|updates|handoff|pricing|support|general", "faq_source_ids": "1,2" }],\n    "faq_generation_note": ""\n  },\n  "human_summary": {\n    "summary_paragraphs": ["<!-- wp:paragraph -->\\n<p>...</p>\\n<!-- /wp:paragraph -->"],\n    "summary_recommendation": "string",\n    "summary_ideal_for": ["string"], "summary_not_for": ["string"], "summary_author_note": ""\n  },\n  "bundled_plugins": [{ "plugin_name": "string", "plugin_category": "page_builder|ecommerce|seo|forms|media|other",\n    "plugin_value": 0, "license_type": "lifetime|annual|extended|basic|limited", "plugin_functionality": "string" }],\n  "demo_gallery": [],\n  "sources_methodology": {\n    "methodology_note": "string", "analysis_date": "YYYY-MM-DD", "data_timeframe": "Last 12 months", "confidence_statement": "string",\n    "sources": [{ "source_id": "[1]", "source_name": "string", "source_url": "URL", "source_type": "forum|review_site|official|social|marketplace|documentation|changelog", "source_date": "YYYY-MM or date-unknown" }]\n  },\n  "search_profile": ""\n}'; }

// ============================================
// GEMINI API
// ============================================

function callGemini(prompt, jsonMode) {
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + GEMINI_API_KEY;
    var payload = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 65000 } };
    if (jsonMode) payload.generationConfig.responseMimeType = 'application/json';
    var response = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true });
    var json = JSON.parse(response.getContentText());
    if (json.error) throw new Error(json.error.message);
    var outputText = json.candidates[0].content.parts[0].text;
    return outputText.replace(/^```json\n?/i, '').replace(/^```\n?/i, '').replace(/\n?```$/i, '').trim();
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function updateStatus(sheet, row, status) { sheet.getRange(row, COL.STATUS).setValue(status); SpreadsheetApp.flush(); }

function testConnection() { try { var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + GEMINI_API_KEY; var payload = { contents: [{ parts: [{ text: 'Say "Connection OK" in exactly 2 words.' }] }], generationConfig: { temperature: 0, maxOutputTokens: 50 } }; var response = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true }); var json = JSON.parse(response.getContentText()); if (json.error) { SpreadsheetApp.getUi().alert('API Error: ' + json.error.message); return; } var text = json.candidates[0].content.parts[0].text; SpreadsheetApp.getUi().alert('✅ Connection OK!\nModel: ' + GEMINI_MODEL + '\nResponse: ' + text); } catch (e) { SpreadsheetApp.getUi().alert('❌ Connection failed: ' + e.message); } }

function saveOutputToDrive() { var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet(); var row = sheet.getActiveRange().getRow(); if (row < 2) { SpreadsheetApp.getUi().alert('Select a data row'); return; } var themeName = sheet.getRange(row, COL.THEME_NAME).getValue(); var jsonOutput = sheet.getRange(row, COL.STEP3_OUTPUT).getValue(); if (!jsonOutput) { SpreadsheetApp.getUi().alert('No output to save. Run Step 3 first.'); return; } try { var folders = DriveApp.getFoldersByName(OUTPUT_FOLDER); var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(OUTPUT_FOLDER); var fileName = themeName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '_profile.json'; var existingFiles = folder.getFilesByName(fileName); if (existingFiles.hasNext()) { existingFiles.next().setTrashed(true); } var file = folder.createFile(fileName, jsonOutput, 'application/json'); var fileUrl = file.getUrl(); sheet.getRange(row, COL.OUTPUT_LINK).setValue(fileUrl); SpreadsheetApp.getUi().alert('✅ Saved: ' + fileName + '\n' + fileUrl); } catch (e) { SpreadsheetApp.getUi().alert('Error saving: ' + e.message); } }

// ============================================
// VALIDATION (v3.19.7)
// ============================================

function validateOutput() { var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet(); var row = sheet.getActiveRange().getRow(); var jsonOutput = sheet.getRange(row, COL.STEP3_OUTPUT).getValue(); if (!jsonOutput) { SpreadsheetApp.getUi().alert('No output to validate.'); return; } try { var json = JSON.parse(jsonOutput); var checks = []; var distModel = (json.theme_basic && json.theme_basic.distribution_model) || 'NOT SET'; checks.push('✓ Distribution: ' + distModel); var sources = json.sources_methodology && json.sources_methodology.sources ? json.sources_methodology.sources.length : 0; checks.push('✓ Sources: ' + sources); if (distModel === 'wordpress_org' || distModel === 'direct_sale') { var srcList = (json.sources_methodology && json.sources_methodology.sources) || []; var tfRefs = srcList.filter(function(s) { return s.source_url && s.source_url.toLowerCase().indexOf('themeforest.net') !== -1; }); if (tfRefs.length > 0) checks.push('🚨 FALSE ATTRIBUTION: ' + tfRefs.length + ' ThemeForest URLs found for ' + distModel + ' theme!'); else checks.push('✓ No false marketplace attribution'); } var plugins = json.plugin_compatibility_enhanced && json.plugin_compatibility_enhanced.plugin_compatibility_list ? json.plugin_compatibility_enhanced.plugin_compatibility_list.length : 0; checks.push('✓ Plugins tested: ' + plugins); var faq = json.faq && json.faq.faq_items ? json.faq.faq_items.length : 0; checks.push('✓ FAQ items: ' + faq); var painPoints = json.community_pain_points && json.community_pain_points.community_pain_points ? json.community_pain_points.community_pain_points : []; checks.push('✓ Pain points: ' + painPoints.length + (painPoints.length < CLEANUP_CONFIG.MIN_PAIN_POINTS ? ' ⚠️ (min: ' + CLEANUP_CONFIG.MIN_PAIN_POINTS + ')' : '')); var stalePPs = painPoints.filter(function(pp) { return pp.stale === true; }); if (stalePPs.length > 0) { checks.push('⚠️ Stale pain points: ' + stalePPs.length); stalePPs.forEach(function(pp) { checks.push('   - [' + pp.severity + '] ' + (pp.title || '').substring(0, 60) + ' (reported: v' + (pp.version_reported || '?') + ')'); }); } var praise = json.community_pain_points && json.community_pain_points.community_praise_stats ? json.community_pain_points.community_praise_stats.length : 0; checks.push('✓ Praise items: ' + praise); var perfMobile = json.performance_metrics ? json.performance_metrics.pagespeed_mobile : 0; var perfTier = json.performance_metrics ? json.performance_metrics.performance_tier : 'none'; checks.push('✓ Performance: mobile=' + perfMobile + ', tier=' + perfTier); var handoff = json.handoff_difficulty ? json.handoff_difficulty.handoff_score : 0; checks.push('✓ Handoff score: ' + handoff); var sp = json.search_profile || ''; checks.push(sp ? '✓ search_profile: ' + sp.substring(0, 80) + '...' : '⚠️ search_profile: EMPTY'); var validIdSet = {}; if (json.sources_methodology && json.sources_methodology.sources) { json.sources_methodology.sources.forEach(function(s) { var m = (s.source_id || '').match(/\[(\d+)\]/); if (m) validIdSet[m[1]] = true; }); } var orphans = deepCountOrphans(json, '', validIdSet); checks.push(orphans === 0 ? '✓ SOURCE INTEGRITY: No orphaned refs' : '🚨 SOURCE INTEGRITY: ' + orphans + ' orphaned [N] refs!'); var ratings = json.theme_ratings && json.theme_ratings.external_ratings ? json.theme_ratings.external_ratings.length : 0; checks.push(ratings > 0 ? '✓ Ratings: ' + ratings : '⚠️ No external ratings'); var verdictSections = [ { name: 'Handoff', obj: json.handoff_difficulty, keys: ['handoff_verdict_safe','handoff_verdict_caution','handoff_verdict_avoid'] }, { name: 'Performance', obj: json.scenario_performance, keys: ['perf_verdict_safe','perf_verdict_caution','perf_verdict_avoid'] }, { name: 'Updates', obj: json.scenario_updates, keys: ['updates_verdict_safe','updates_verdict_caution','updates_verdict_avoid'] }, { name: 'Compat', obj: json.plugin_compatibility_enhanced, keys: ['compat_verdict_safe','compat_verdict_caution','compat_verdict_avoid'] } ]; var emptyVerdicts = 0; verdictSections.forEach(function(sec) { if (!sec.obj) return; sec.keys.forEach(function(k) { if (!sec.obj[k] || sec.obj[k].length < 20) emptyVerdicts++; }); }); checks.push(emptyVerdicts === 0 ? '✓ All verdicts populated' : '⚠️ ' + emptyVerdicts + ' empty/short verdicts'); var pluginNames = {}; if (json.plugin_compatibility_enhanced && json.plugin_compatibility_enhanced.plugin_compatibility_list) { json.plugin_compatibility_enhanced.plugin_compatibility_list.forEach(function(p) { pluginNames[(p.plugin || '').toLowerCase()] = true; }); } var missingPlugins = []; painPoints.forEach(function(pp) { var text = ((pp.title || '') + ' ' + (pp.description || '')).toLowerCase(); var knownPlugins = ['woocommerce', 'elementor', 'wpml', 'acf', 'yoast', 'contact form 7', 'cf7', 'wpbakery', 'divi', 'bricks', 'beaver builder', 'rankmath']; knownPlugins.forEach(function(kp) { if (text.indexOf(kp) !== -1) { var found = Object.keys(pluginNames).some(function(n) { return n.indexOf(kp) !== -1; }); if (!found && missingPlugins.indexOf(kp) === -1) missingPlugins.push(kp); } }); }); if (missingPlugins.length > 0) checks.push('🚨 PLUGIN CROSS-REF: ' + missingPlugins.join(', ') + ' in pain points but NOT in compat list'); else checks.push('✓ Plugin cross-reference OK'); SpreadsheetApp.getUi().alert('VALIDATION REPORT\n\n' + checks.join('\n')); } catch (e) { SpreadsheetApp.getUi().alert('Validation error: ' + e.message); } }

// ============================================
// TAXONOMY CONFIG & ASSIGNMENT (v3.19.1+)
// ============================================

var TAXONOMY_CONFIG = { theme_types: { field: 'theme_types', max: 2, terms: { 'agency': 1189, 'blog-magazine': 1110, 'corporate': 1107, 'creative-portfolio': 1108, 'multipurpose': 1105, 'niche-specific': 1109, 'woocommerce': 1106 } }, pricing_model: { field: 'pricing_model', max: 1, terms: { 'free': 1089, 'freemium': 1090, 'one-time': 1091, 'premium': 1194, 'subscription': 1092 } }, handoff_difficulty: { field: 'handoff_difficulty', max: 1, terms: { 'easy': 1093, 'moderate': 1094, 'hard': 1095, 'very-hard': 1096 } }, vendor_lock_in: { field: 'vendor_lock_in', max: 1, terms: { 'minimal': 1097, 'moderate': 1098, 'high': 1099, 'critical': 1100 } }, performance_tier: { field: 'performance_tier', max: 1, terms: { 'excellent': 1192, 'good': 1101, 'needs_work': 1102, 'poor': 1103, 'unknown': 1104 } }, page_builders: { field: 'page_builders', max: -1, terms: { 'bricks': 1115, 'divi-builder': 1114, 'elementor': 1111, 'gutenberg': 1112, 'proprietary': 1116, 'wpbakery': 1113 } }, theme_architecture: { field: 'theme_architecture', max: 1, terms: { 'block-theme-fse': 1118, 'classic-theme': 1117, 'hybrid': 1119 } }, support_quality: { field: 'support_quality', max: 1, terms: { 'excellent': 1085, 'good': 1086, 'average': 1193, 'poor': 1087, 'unknown': 1088 } } };

function mapPricingModel(data) { var ids = []; var tp = data.theme_pricing || {}; var pm = (tp.pricing_model || '').toLowerCase(); var lt = (tp.license_type || '').toLowerCase(); var price = tp.base_price || 0; var terms = TAXONOMY_CONFIG.pricing_model.terms; if (pm === 'free' || lt === 'free') { ids.push(terms['free']); } else if (pm === 'one_time_purchase' || pm === 'one-time' || lt === 'standard_commercial') { ids.push(terms['one-time']); } else if (pm === 'annual_subscription' || pm === 'annual' || lt === 'subscription_based') { ids.push(terms['subscription']); } else if (pm === 'lifetime_license' || pm === 'lifetime') { ids.push(terms['one-time']); } if (lt === 'freemium' || (price === 0 && lt !== 'free' && ids.length === 0)) { ids.push(terms['freemium']); } if (ids.length === 0) ids.push(terms['premium']); return ids; }

function mapPerformanceTier(data) { var pm = data.performance_metrics || {}; var tier = (pm.performance_tier || '').toLowerCase(); var mobile = pm.pagespeed_mobile || 0; var terms = TAXONOMY_CONFIG.performance_tier.terms; if (tier && terms[tier]) return [terms[tier]]; if (mobile >= 90) return [terms['excellent']]; if (mobile >= 70) return [terms['good']]; if (mobile >= 50) return [terms['needs_work']]; if (mobile > 0) return [terms['poor']]; return [terms['good']]; }

function mapHandoffDifficulty(data) { var hd = data.handoff_difficulty || {}; var score = hd.handoff_score || 5; var terms = TAXONOMY_CONFIG.handoff_difficulty.terms; if (score >= 8) return [terms['easy']]; if (score >= 5) return [terms['moderate']]; if (score >= 3) return [terms['hard']]; return [terms['very-hard']]; }

function mapThemeArchitecture(data) { var tb = data.theme_basic || {}; var hs = data.human_summary || {}; var terms = TAXONOMY_CONFIG.theme_architecture.terms; var tagline = (tb.theme_tagline || '').toLowerCase(); var summaryStr = JSON.stringify(hs).toLowerCase(); var combined = tagline + ' ' + summaryStr; var fseIndicators = ['full site editing', 'block theme', 'fse theme', 'site editor', 'block-based theme']; var hybridIndicators = ['hybrid theme', 'block support', 'supports block editor and classic', 'hybrid approach', 'classic and block']; for (var i = 0; i < fseIndicators.length; i++) { if (combined.indexOf(fseIndicators[i]) !== -1) return [terms['block-theme-fse']]; } for (var j = 0; j < hybridIndicators.length; j++) { if (combined.indexOf(hybridIndicators[j]) !== -1) return [terms['hybrid']]; } return [terms['classic-theme']]; }

function mapBuilderTags(data) { var ids = []; var terms = TAXONOMY_CONFIG.page_builders.terms; var plugins = (data.plugin_compatibility_enhanced && data.plugin_compatibility_enhanced.plugin_compatibility_list) || []; var bundled = data.bundled_plugins || []; var builderKeywords = { 'elementor': 'elementor', 'wpbakery': 'wpbakery', 'visual composer': 'wpbakery', 'divi': 'divi-builder', 'bricks': 'bricks', 'gutenberg': 'gutenberg' }; var themeName = ((data.theme_basic && data.theme_basic.theme_author) || '').toLowerCase().replace(/[^a-z0-9]/g, ''); var themeTitle = ((data.theme_basic && data.theme_basic.theme_tagline) || '').toLowerCase(); for (var kw0 in builderKeywords) { if (themeName === kw0 || themeTitle.indexOf(kw0 + ' builder') !== -1 || themeTitle.indexOf(kw0 + ' theme') !== -1) { var slug0 = builderKeywords[kw0]; if (terms[slug0] && ids.indexOf(terms[slug0]) === -1) ids.push(terms[slug0]); } } plugins.forEach(function(p) { var pname = (p.plugin || '').toLowerCase(); for (var kw in builderKeywords) { if (pname.indexOf(kw) !== -1) { var slug = builderKeywords[kw]; if (terms[slug] && ids.indexOf(terms[slug]) === -1) ids.push(terms[slug]); } } }); bundled.forEach(function(bp) { if ((bp.plugin_category || '') !== 'page_builder') return; var bname = (bp.plugin_name || '').toLowerCase(); for (var kw in builderKeywords) { if (bname.indexOf(kw) !== -1) { var slug = builderKeywords[kw]; if (terms[slug] && ids.indexOf(terms[slug]) === -1) ids.push(terms[slug]); } } }); if (ids.length === 0) { var tagline = ((data.theme_basic && data.theme_basic.theme_tagline) || '').toLowerCase(); if (tagline.indexOf('gutenberg') !== -1 || tagline.indexOf('block editor') !== -1) { ids.push(terms['gutenberg']); } } return ids; }

function mapThemeTypes(data) { var ids = []; var terms = TAXONOMY_CONFIG.theme_types.terms; var tagline = ((data.theme_basic && data.theme_basic.theme_tagline) || '').toLowerCase(); var summaryStr = JSON.stringify(data.human_summary || {}).toLowerCase(); var combined = tagline + ' ' + summaryStr; var plugins = (data.plugin_compatibility_enhanced && data.plugin_compatibility_enhanced.plugin_compatibility_list) || []; var wooPlugin = plugins.find(function(p) { return (p.plugin || '').toLowerCase().indexOf('woocommerce') !== -1; }); var wooKeywords = ['woocommerce theme', 'ecommerce theme', 'shop theme', 'online store theme']; var isWooDedicated = wooKeywords.some(function(k) { return combined.indexOf(k) !== -1; }); if (isWooDedicated && wooPlugin && wooPlugin.compatibility_status === 'full') ids.push(terms['woocommerce']); var nicheKeywords = ['hotel', 'travel', 'booking', 'real estate', 'property', 'listing', 'restaurant', 'food', 'medical', 'health', 'education', 'school', 'church', 'nonprofit', 'automotive', 'car dealer', 'job board', 'recruitment', 'wedding', 'event', 'fitness', 'gym', 'lawyer', 'law firm', 'construction']; var isNiche = nicheKeywords.some(function(k) { return combined.indexOf(k) !== -1; }); if (isNiche) ids.push(terms['niche-specific']); if (combined.indexOf('blog') !== -1 || combined.indexOf('magazine') !== -1 || combined.indexOf('news') !== -1) { if (ids.indexOf(terms['blog-magazine']) === -1) ids.push(terms['blog-magazine']); } if (combined.indexOf('agency') !== -1 || combined.indexOf('freelancer') !== -1) { if (ids.indexOf(terms['agency']) === -1) ids.push(terms['agency']); } if (combined.indexOf('portfolio') !== -1 || combined.indexOf('creative') !== -1) { if (ids.indexOf(terms['creative-portfolio']) === -1) ids.push(terms['creative-portfolio']); } if (combined.indexOf('corporate') !== -1 || combined.indexOf('business') !== -1) { if (ids.indexOf(terms['corporate']) === -1) ids.push(terms['corporate']); } if (combined.indexOf('multipurpose') !== -1 || combined.indexOf('multi-purpose') !== -1 || ids.length === 0) { if (ids.indexOf(terms['multipurpose']) === -1) ids.push(terms['multipurpose']); } return ids.slice(0, 2); }

function mapVendorLockIn(data) { var ids = []; var terms = TAXONOMY_CONFIG.vendor_lock_in.terms; var bundled = data.bundled_plugins || []; var bundledCount = bundled.length; var plugins = (data.plugin_compatibility_enhanced && data.plugin_compatibility_enhanced.plugin_compatibility_list) || []; var hasProprietary = false; plugins.forEach(function(p) { var cat = (p.plugin_category || '').toLowerCase(); if (cat === 'page_builder') { var name = (p.plugin || '').toLowerCase(); var themePrefix = ((data.theme_basic && data.theme_basic.theme_author) || '').toLowerCase().replace(/[^a-z0-9]/g, ''); if (themePrefix && name.indexOf(themePrefix) !== -1) hasProprietary = true; } }); var painTexts = JSON.stringify(data.community_pain_points || {}).toLowerCase(); var shortcodeMentions = (painTexts.match(/shortcode/g) || []).length; if (hasProprietary && bundledCount >= 5) return [terms['critical']]; if (hasProprietary || bundledCount >= 4 || shortcodeMentions >= 3) return [terms['high']]; if (bundledCount >= 2 || shortcodeMentions >= 1) return [terms['moderate']]; return [terms['minimal']]; }

function mapSupportQuality(data) { var terms = TAXONOMY_CONFIG.support_quality.terms; var painPoints = (data.community_pain_points && data.community_pain_points.community_pain_points) || []; var praise = (data.community_pain_points && data.community_pain_points.community_praise_stats) || []; var supportComplaints = painPoints.filter(function(pp) { return pp.category === 'support'; }).length; var supportPraise = praise.filter(function(p) { return (p.category || '').toLowerCase() === 'support' || (p.positive_aspect || '').toLowerCase().indexOf('support') !== -1; }).length; if (supportPraise >= 2 && supportComplaints === 0) return [terms['excellent']]; if (supportPraise >= 1 && supportComplaints <= 1) return [terms['good']]; if (supportComplaints >= 3) return [terms['poor']]; if (supportComplaints >= 1) return [terms['average']]; return [terms['unknown']]; }

function assignTaxonomies() { var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet(); var row = sheet.getActiveRange().getRow(); if (row < 2) { SpreadsheetApp.getUi().alert('Select a data row (row 2+)'); return; } var jsonOutput = sheet.getRange(row, COL.STEP3_OUTPUT).getValue(); if (!jsonOutput) { SpreadsheetApp.getUi().alert('No Step 3 output. Run pipeline first.'); return; } try { var data = JSON.parse(jsonOutput); var taxonomy = { theme_types: mapThemeTypes(data), pricing_model: mapPricingModel(data), handoff_difficulty: mapHandoffDifficulty(data), vendor_lock_in: mapVendorLockIn(data), performance_tier: mapPerformanceTier(data), page_builders: mapBuilderTags(data), theme_architecture: mapThemeArchitecture(data), support_quality: mapSupportQuality(data) }; sheet.getRange(row, COL_TAXONOMY).setValue(JSON.stringify(taxonomy, null, 2)); var summary = []; for (var key in taxonomy) { var termNames = []; var terms = TAXONOMY_CONFIG[key].terms; taxonomy[key].forEach(function(id) { for (var slug in terms) { if (terms[slug] === id) termNames.push(slug); } }); summary.push(key + ': ' + termNames.join(', ')); } SpreadsheetApp.getUi().alert('✅ Taxonomies assigned!\n\n' + summary.join('\n') + '\n\n⚠️ Run "Re-run Cleanup Only" to update search_profile with architecture from taxonomy.'); } catch (e) { SpreadsheetApp.getUi().alert('Error: ' + e.message); } }

// ============================================
// VALIDATE ALL THEMES (v1.1)
// ============================================

function validateAllThemes() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();
    var lastRow = sheet.getLastRow();
    var HEADERS = ['Theme', 'Field', 'Severity', 'Layer', 'Current Value', 'Expected / Issue', 'Source to Verify', 'AI Verdict', 'Human Decision', 'Notes'];
    var NUM_COLS = HEADERS.length;
    var valSheet = ss.getSheetByName('Validation');
    if (valSheet) ss.deleteSheet(valSheet);
    valSheet = ss.insertSheet('Validation');
    valSheet.getRange(1, 1, 1, NUM_COLS).setValues([HEADERS]);
    valSheet.getRange(1, 1, 1, NUM_COLS).setFontWeight('bold');
    valSheet.setFrozenRows(1);
    valSheet.setColumnWidth(1, 140); valSheet.setColumnWidth(2, 220); valSheet.setColumnWidth(3, 80); valSheet.setColumnWidth(4, 60);
    valSheet.setColumnWidth(5, 280); valSheet.setColumnWidth(6, 350); valSheet.setColumnWidth(7, 350);
    valSheet.setColumnWidth(8, 120); valSheet.setColumnWidth(9, 120); valSheet.setColumnWidth(10, 200);
    var allRows = []; var themesProcessed = 0;
    for (var row = 2; row <= lastRow; row++) {
        var themeName = sheet.getRange(row, COL.THEME_NAME).getValue();
        var jsonStr = sheet.getRange(row, COL.STEP3_OUTPUT).getValue();
        if (!themeName || !jsonStr) continue;
        var taxonomyStr = sheet.getRange(row, COL_TAXONOMY).getValue();
        var taxonomy = null;
        try { taxonomy = taxonomyStr ? JSON.parse(taxonomyStr) : null; } catch (e) {}
        try {
            var data = JSON.parse(jsonStr);
            var issues = validateThemeJSON(data, themeName, taxonomy);
            issues.forEach(function(issue) {
                allRows.push([themeName, issue.field, issue.severity, issue.layer, issue.current, issue.expected, issue.verifyUrl, '', '', '']);
            });
            themesProcessed++;
        } catch (e) {
            allRows.push([themeName, 'JSON_PARSE', '🔴 ERROR', 'L1', e.message, 'Fix JSON in column F', '', '', '', '']);
        }
    }
    if (allRows.length > 0) {
        valSheet.getRange(2, 1, allRows.length, NUM_COLS).setValues(allRows);
        for (var i = 0; i < allRows.length; i++) {
            var sev = allRows[i][2];
            var color = sev.indexOf('ERROR') !== -1 ? '#f4cccc' : sev.indexOf('WARN') !== -1 ? '#fff2cc' : '#d9ead3';
            valSheet.getRange(i + 2, 1, 1, NUM_COLS).setBackground(color);
        }
    }
    var errorCount = allRows.filter(function(r) { return r[2].indexOf('ERROR') !== -1; }).length;
    var warnCount = allRows.filter(function(r) { return r[2].indexOf('WARN') !== -1; }).length;
    var infoCount = allRows.filter(function(r) { return r[2].indexOf('INFO') !== -1; }).length;
    SpreadsheetApp.getUi().alert('✅ Validation complete!\n\nThemes: ' + themesProcessed + '\n🔴 Errors: ' + errorCount + '\n🟡 Warnings: ' + warnCount + '\n🟢 Info: ' + infoCount + '\n\nResults → "Validation" tab\nCopy tab contents → paste into WP Admin Verify Dashboard');
}

function validateThemeJSON(data, themeName, taxonomy) {
    var issues = [];
    var tb = data.theme_basic || {}; var pm = data.performance_metrics || {}; var tp = data.theme_pricing || {};
    var hd = data.handoff_difficulty || {}; var hs = data.human_summary || {}; var sp = data.search_profile || '';
    var pp = (data.community_pain_points && data.community_pain_points.community_pain_points) || [];
    var praise = (data.community_pain_points && data.community_pain_points.community_praise_stats) || [];
    var plugins = (data.plugin_compatibility_enhanced && data.plugin_compatibility_enhanced.plugin_compatibility_list) || [];
    var bundled = data.bundled_plugins || [];
    var sources = (data.sources_methodology && data.sources_methodology.sources) || [];
    var ratings = (data.theme_ratings && data.theme_ratings.external_ratings) || [];
    var demoUrl = tb.demo_url || '';

    function add(field, severity, layer, current, expected, url) {
        issues.push({ field: field, severity: severity, layer: layer, current: String(current).substring(0, 250), expected: String(expected).substring(0, 300), verifyUrl: url || '' });
    }

    // 1. SEARCH PROFILE CROSS-CHECK
    if (!sp) { add('search_profile', '🔴 ERROR', 'L1', '(empty)', 'Run Assign Taxonomies → Re-run Cleanup', ''); }
    else {
        var spPerfMatch = sp.match(/perf:(\w+)/); var spPerfTier = spPerfMatch ? spPerfMatch[1] : '';
        var jsonPerfTier = (pm.performance_tier || '').toLowerCase();
        if (spPerfTier && jsonPerfTier && spPerfTier !== jsonPerfTier) { add('search_profile → perf', '🔴 ERROR', 'L1', 'SP: ' + spPerfTier, 'JSON: ' + jsonPerfTier, pm.pagespeed_link || ''); }
        var spMobMatch = sp.match(/(\d+)mob/); var spMob = spMobMatch ? parseInt(spMobMatch[1]) : 0;
        if (spMob > 0 && pm.pagespeed_mobile > 0 && spMob !== pm.pagespeed_mobile) { add('search_profile → mobile score', '🔴 ERROR', 'L1', 'SP: ' + spMob + 'mob', 'JSON: ' + pm.pagespeed_mobile, pm.pagespeed_link || ''); }
        var spPriceMatch = sp.match(/price:([^(|]+)/); var spPrice = spPriceMatch ? spPriceMatch[1].trim() : '';
        var jsonPriceNorm = (tp.pricing_model || '').toLowerCase().replace('one_time_purchase', 'one-time').replace('annual_subscription', 'annual').replace('lifetime_license', 'lifetime');
        if (spPrice && jsonPriceNorm && spPrice !== jsonPriceNorm) { add('search_profile → price', '🟡 WARN', 'L1', 'SP: ' + spPrice, 'JSON pricing_model: ' + tp.pricing_model, ''); }
        var spHandoffMatch = sp.match(/handoff:(\d+)/); var spHandoff = spHandoffMatch ? parseInt(spHandoffMatch[1]) : -1;
        if (spHandoff >= 0 && hd.handoff_score !== undefined && spHandoff !== hd.handoff_score) { add('search_profile → handoff', '🔴 ERROR', 'L1', 'SP: ' + spHandoff, 'JSON: ' + hd.handoff_score, ''); }
        var spHasCritSec = sp.indexOf('security:critical-historical') !== -1; var spHasMajSec = sp.indexOf('security:major-historical') !== -1;
        if (spHasCritSec || spHasMajSec) {
            var secKw = ['vulnerab', 'cve', 'exploit', 'malware', 'backdoor', 'xss attack', 'sql inject', 'remote code execution', 'rce', 'csrf attack', 'privilege escalat', 'zero-day', '0-day'];
            var justifiedBySeverity = spHasCritSec ? 'critical' : 'major';
            var justified = pp.some(function(p) { if (p.stale) return false; if (p.severity !== justifiedBySeverity) return false; var text = ((p.category || '') + (p.title || '') + (p.description || '')).toLowerCase(); return secKw.some(function(k) { return text.indexOf(k) !== -1; }); });
            if (!justified) { var nonStaleCrit = pp.filter(function(p) { return !p.stale && (p.severity === 'critical' || p.severity === 'major'); }); add('search_profile → security tag', '🔴 ERROR', 'L1', spHasCritSec ? 'security:critical-historical' : 'security:major-historical', 'No matching non-stale pain point with security keywords. ' + nonStaleCrit.length + ' non-stale critical/major exist.', ''); }
        }
        var salesRaw = String(tb.sales_count || '').replace(/[^0-9]/g, ''); var salesNum = parseInt(salesRaw, 10) || 0;
        var expectedInstallTag = ''; if (salesNum >= 1000000) expectedInstallTag = '1M+installs'; else if (salesNum >= 200000) expectedInstallTag = '200k+installs'; else if (salesNum >= 100000) expectedInstallTag = '100k+installs'; else if (salesNum >= 50000) expectedInstallTag = '50k+installs'; else if (salesNum >= 10000) expectedInstallTag = '10k+installs'; else if (salesNum >= 1000) expectedInstallTag = '1k+installs';
        if (expectedInstallTag && sp.indexOf(expectedInstallTag) === -1) { var installTags = ['1M+installs', '200k+installs', '100k+installs', '50k+installs', '10k+installs', '1k+installs']; var foundTag = installTags.find(function(t) { return sp.indexOf(t) !== -1; }); if (foundTag) { var foundIdx = installTags.indexOf(foundTag); var expectedIdx = installTags.indexOf(expectedInstallTag); if (foundIdx > expectedIdx) { add('search_profile → installs', '🟡 WARN', 'L1', 'SP: ' + foundTag, 'Expected: ' + expectedInstallTag + ' (sales: ' + salesNum + ')', ''); } } else { add('search_profile → installs', '🟡 WARN', 'L1', '(no install tag)', 'Expected: ' + expectedInstallTag + ' (sales: ' + salesNum + ')', ''); } }
        plugins.forEach(function(p) { if ((p.plugin_category || '') !== 'page_builder') return; var pname = (p.plugin || '').toLowerCase(); var builderKeys = ['elementor', 'wpbakery', 'divi', 'bricks', 'beaver', 'gutenberg']; builderKeys.forEach(function(bk) { if (pname.indexOf(bk) === -1) return; if (sp.toLowerCase().indexOf(bk) === -1) { add('search_profile → builder', '🔴 ERROR', 'L1', 'Missing: ' + bk, 'Builder in compat_list (status: ' + p.compatibility_status + ') but not in search_profile tags', ''); } }); });
        if (sp.indexOf(',classic,') !== -1 || (sp.indexOf(',classic') !== -1 && sp.indexOf('classic-theme') === -1)) { add('search_profile → architecture', '🔴 ERROR', 'L1', 'Old slug: classic', 'Should be: classic-theme', ''); }
        if (sp.indexOf('block-fse') !== -1 && sp.indexOf('block-theme-fse') === -1) { add('search_profile → architecture', '🔴 ERROR', 'L1', 'Old slug: block-fse', 'Should be: block-theme-fse', ''); }
        var spHasWoo = sp.indexOf(',woocommerce') !== -1 || sp.indexOf('tags:woocommerce') !== -1;
        if (spHasWoo) { var taxHasWoo = taxonomy && taxonomy.theme_types && taxonomy.theme_types.some(function(id) { return id === TAXONOMY_CONFIG.theme_types.terms['woocommerce']; }); if (!taxHasWoo) { add('search_profile → woocommerce', '🟡 WARN', 'L1', 'woocommerce tag present', 'But theme-type ≠ woocommerce in taxonomy.', ''); } }
    }

    // 2. CROSS-FIELD CONSISTENCY
    var expectedHandoff = calculateHandoffScore(hd.handoff_panel_complexity, hd.handoff_docs_quality, hd.handoff_learning_curve);
    if (hd.handoff_score !== undefined && hd.handoff_score !== expectedHandoff) { add('handoff_score', '🔴 ERROR', 'L1', hd.handoff_score, 'Expected ' + expectedHandoff + ' from panel=' + hd.handoff_panel_complexity + ', docs=' + hd.handoff_docs_quality + ', curve=' + hd.handoff_learning_curve, ''); }
    if (hd.handoff_learning_curve === 'weeks' && hd.handoff_panel_complexity !== 'complex' && hd.handoff_panel_complexity !== 'overwhelming') { add('handoff consistency', '🟡 WARN', 'L1', 'curve=weeks, panel=' + hd.handoff_panel_complexity, 'Spec requires: weeks → panel must be complex or overwhelming', ''); }
    var mobile = pm.pagespeed_mobile || 0;
    if (mobile > 0) { var expectedTier = getPerformanceTier(mobile); var currentTier = (pm.performance_tier || '').toLowerCase(); if (currentTier && currentTier !== expectedTier) { add('performance_tier', '🔴 ERROR', 'L1', currentTier, 'Expected: ' + expectedTier + ' (mobile: ' + mobile + ')', pm.pagespeed_link || ''); } if (mobile < 50) { var perfSafe = (data.scenario_performance && data.scenario_performance.perf_verdict_safe) || ''; if (perfSafe.length > 20) { add('perf_verdict_safe', '🟡 WARN', 'L1', perfSafe.substring(0, 60) + '...', 'Should be empty when mobile < 50 (current: ' + mobile + ')', pm.pagespeed_link || ''); } } }
    if (tp.pricing_model && tp.pricing_model.indexOf('_') !== -1) { add('pricing_model format', '🟢 INFO', 'L1', tp.pricing_model, 'Contains underscore — SP conversion uses hyphens.', ''); }
    var dist = (tb.distribution_model || '').toLowerCase();
    if (dist === 'wordpress_org' || dist === 'direct_sale') { sources.forEach(function(s) { if (s.source_url && s.source_url.toLowerCase().indexOf('themeforest.net') !== -1) { add('false attribution', '🔴 ERROR', 'L1', 'ThemeForest URL: ' + s.source_url, 'Theme is ' + dist + ' — no ThemeForest sources allowed', ''); } }); ratings.forEach(function(r) { if (r.rating_source && r.rating_source.toLowerCase().indexOf('themeforest') !== -1) { add('false rating attribution', '🔴 ERROR', 'L1', 'ThemeForest rating', 'Theme is ' + dist + ' — should use WordPress.org or author site ratings', ''); } }); }

    // 3. COMPLETENESS
    if (pp.length < 8) { add('pain_points count', '🟡 WARN', 'L1', pp.length + ' pain points', 'Minimum 8 required', ''); }
    if (praise.length < 3) { add('praise count', '🟡 WARN', 'L1', praise.length + ' praise items', 'Minimum 3 required', ''); }
    if (ratings.length === 0) { add('external_ratings', '🟡 WARN', 'L1', '(empty)', 'At least 1 rating source required', ''); }
    var verdictChecks = [ { section: 'handoff', obj: data.handoff_difficulty, keys: ['handoff_verdict_safe', 'handoff_verdict_caution', 'handoff_verdict_avoid'] }, { section: 'performance', obj: data.scenario_performance, keys: ['perf_verdict_safe', 'perf_verdict_caution', 'perf_verdict_avoid'] }, { section: 'updates', obj: data.scenario_updates, keys: ['updates_verdict_safe', 'updates_verdict_caution', 'updates_verdict_avoid'] }, { section: 'compatibility', obj: data.plugin_compatibility_enhanced, keys: ['compat_verdict_safe', 'compat_verdict_caution', 'compat_verdict_avoid'] } ];
    verdictChecks.forEach(function(vc) { if (!vc.obj) return; vc.keys.forEach(function(k) { var val = vc.obj[k] || ''; if (val.length > 0 && val.length < 20) { add(vc.section + ' → ' + k, '🟡 WARN', 'L1', val, 'Verdict too short (< 20 words).', ''); } }); });
    var requiredFields = [ { path: 'theme_basic.theme_version', val: tb.theme_version }, { path: 'theme_basic.last_update', val: tb.last_update }, { path: 'theme_basic.sales_count', val: tb.sales_count }, { path: 'theme_basic.distribution_model', val: tb.distribution_model }, { path: 'theme_basic.demo_url', val: tb.demo_url }, { path: 'performance_metrics.pagespeed_mobile', val: pm.pagespeed_mobile }, { path: 'human_summary.summary_recommendation', val: hs.summary_recommendation } ];
    requiredFields.forEach(function(rf) { if (!rf.val && rf.val !== 0) { add(rf.path, '🟡 WARN', 'L1', '(empty)', 'Required field missing', ''); } });

    // 4. DATA QUALITY
    pp.forEach(function(p, idx) { if (isGenericUrl(p.source_url)) { add('pain_point[' + idx + '] URL', '🟡 WARN', 'L1', p.source_url || '(empty)', 'Generic URL. Title: ' + (p.title || '').substring(0, 60), ''); } });
    praise.forEach(function(p, idx) { if (isGenericUrl(p.source_url)) { add('praise[' + idx + '] URL', '🟡 WARN', 'L1', p.source_url || '(empty)', 'Generic URL. Title: ' + (p.title || '').substring(0, 40), ''); } });

    // 4c. Plugin cross-reference — FIX: includes layer param + bundled check
    var pluginNamesLower = {}; plugins.forEach(function(p) { pluginNamesLower[(p.plugin || '').toLowerCase()] = true; });
    var bundledNamesLower = {}; bundled.forEach(function(bp) { bundledNamesLower[(bp.plugin_name || '').toLowerCase()] = true; });
    var knownPlugins = ['woocommerce', 'elementor', 'wpml', 'acf', 'yoast', 'contact form 7', 'wpbakery', 'divi', 'bricks', 'beaver builder', 'rankmath', 'wp rocket', 'jetpack', 'wordfence'];
    pp.forEach(function(p) {
        var text = ((p.title || '') + ' ' + (p.description || '')).toLowerCase();
        knownPlugins.forEach(function(kp) {
            if (text.indexOf(kp) === -1) return;
            var inCompat = Object.keys(pluginNamesLower).some(function(n) { return n.indexOf(kp) !== -1; });
            if (inCompat) return;
            var isBundled = Object.keys(bundledNamesLower).some(function(n) { return n.indexOf(kp) !== -1; });
            if (isBundled) return;
            add('plugin cross-ref', '🔴 ERROR', 'L1', kp + ' in pain point', 'Not in plugin_compatibility_list or bundled_plugins. Pain: ' + (p.title || '').substring(0, 50), '');
        });
    });

    var unknownVersionCount = pp.filter(function(p) { var v = (p.version_reported || '').trim().toLowerCase(); return !v || v === 'unknown' || v === ''; }).length;
    if (unknownVersionCount > pp.length * 0.7 && pp.length >= 5) { add('version_reported coverage', '🟡 WARN', 'L1', unknownVersionCount + '/' + pp.length + ' unknown', 'Most pain points lack version_reported — stale detection ineffective', ''); }
    bundled.forEach(function(bp) { if ((bp.plugin_category || '') !== 'page_builder') return; var bname = (bp.plugin_name || '').toLowerCase(); if (sp) { var bKeys = ['elementor', 'wpbakery', 'divi', 'bricks', 'beaver']; bKeys.forEach(function(bk) { if (bname.indexOf(bk) !== -1 && sp.indexOf(bk) === -1) { add('bundled builder in SP', '🔴 ERROR', 'L1', 'Bundled: ' + bp.plugin_name, 'Builder not in search_profile tags', ''); } }); } });

    // 5. VERIFY TARGETS (Layer L2)
    var pricingUrl = '';
    if (dist === 'themeforest') { var tfRating = ratings.find(function(r) { return (r.rating_source || '').toLowerCase().indexOf('themeforest') !== -1; }); pricingUrl = tfRating ? tfRating.rating_url : ''; } else { pricingUrl = demoUrl; }
    add('💡 VERIFY: pricing', '🟢 INFO', 'L2', tp.pricing_model + ' / $' + (tp.base_price || 0), 'Verify pricing model and price against official source', pricingUrl);
    if (tb.last_update) { var changelogUrl = ''; if (dist === 'wordpress_org') changelogUrl = 'https://wordpress.org/themes/' + themeName.toLowerCase().replace(/\s+/g, '-') + '/'; else if (dist === 'themeforest') changelogUrl = pricingUrl; else changelogUrl = demoUrl; add('💡 VERIFY: last_update', '🟢 INFO', 'L2', tb.last_update, 'Verify last update date against changelog', changelogUrl); }
    var archTags = ['block-theme-fse', 'classic-theme', 'hybrid']; var spArch = archTags.find(function(a) { return sp.indexOf(a) !== -1; });
    if (spArch) { var archVerifyUrl = dist === 'wordpress_org' ? 'https://wordpress.org/themes/' + themeName.toLowerCase().replace(/\s+/g, '-') + '/' : demoUrl; add('💡 VERIFY: architecture', '🟢 INFO', 'L2', spArch || '(none)', 'Verify: check theme.json presence, readme.txt', archVerifyUrl); }
    if (salesNum > 0) { add('💡 VERIFY: sales_count', '🟢 INFO', 'L2', salesNum.toLocaleString(), 'Verify against marketplace page', pricingUrl); }
    add('💡 VERIFY: distribution', '🟢 INFO', 'L2', dist, 'Confirm primary distribution channel', demoUrl);
    if (bundled.length > 0) { add('💡 VERIFY: bundled_plugins', '🟢 INFO', 'L2', bundled.map(function(b) { return b.plugin_name; }).join(', '), 'Verify bundled plugins list against theme features page', demoUrl); }
    var spotCheckCount = Math.min(3, sources.length); var usedIndices = {};
    for (var i = 0; i < spotCheckCount; i++) { var randIdx; var attempts = 0; do { randIdx = Math.floor(Math.random() * sources.length); attempts++; } while (usedIndices[randIdx] && attempts < 20); usedIndices[randIdx] = true; var s = sources[randIdx]; add('💡 SPOT CHECK: source[' + s.source_id + ']', '🟢 INFO', 'L2', s.source_name, 'Verify URL is live and relevant', s.source_url); }

    return issues;
}

// ============================================
// REVIEW DASHBOARD
// ============================================

function prepareReviewDashboard() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var valSheet = ss.getSheetByName('Validation');
    if (!valSheet) { SpreadsheetApp.getUi().alert('Run "Validate All Themes" first.'); return; }
    var lastRow = valSheet.getLastRow();
    if (lastRow < 2) { SpreadsheetApp.getUi().alert('Validation tab is empty.'); return; }
    var aiVerdictRule = SpreadsheetApp.newDataValidation().requireValueInList(['✅ confirmed', '⚠️ outdated', '❌ wrong', '🔍 unverified', 'N/A'], true).setAllowInvalid(false).build();
    valSheet.getRange(2, 8, lastRow - 1, 1).setDataValidation(aiVerdictRule);
    var humanDecisionRule = SpreadsheetApp.newDataValidation().requireValueInList(['✅ OK', '🔧 fix applied', '🗓️ fix later', '❌ cannot fix', '⏭️ skip'], true).setAllowInvalid(false).build();
    valSheet.getRange(2, 9, lastRow - 1, 1).setDataValidation(humanDecisionRule);
    for (var i = 2; i <= lastRow; i++) {
        var severity = valSheet.getRange(i, 3).getValue(); var field = valSheet.getRange(i, 2).getValue();
        if (severity.indexOf('ERROR') !== -1 && field.indexOf('VERIFY') === -1) { if (!valSheet.getRange(i, 8).getValue()) { valSheet.getRange(i, 8).setValue('N/A'); } }
        if (severity.indexOf('INFO') !== -1 && field.indexOf('SPOT CHECK') !== -1) { if (!valSheet.getRange(i, 9).getValue()) { valSheet.getRange(i, 9).setValue('⏭️ skip'); } }
    }
    var range = valSheet.getRange(2, 1, lastRow - 1, 10);
    range.sort({ column: 3, ascending: true });
    SpreadsheetApp.getUi().alert('📋 Review Dashboard ready!\n\nCol 8: AI Verdict\nCol 9: Human Decision\nCol 10: Notes\n\n1. 🔴 ERROR → fix in pipeline\n2. 🟡 WARN → verify with L2 prompt\n3. 🟢 VERIFY → fill AI Verdict\n4. Fill Human Decision\n5. Run "Review Summary"');
}

function reviewSummary() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var valSheet = ss.getSheetByName('Validation');
    if (!valSheet) { SpreadsheetApp.getUi().alert('No Validation tab found.'); return; }
    var lastRow = valSheet.getLastRow();
    if (lastRow < 2) { SpreadsheetApp.getUi().alert('Validation tab is empty.'); return; }
    var data = valSheet.getRange(2, 1, lastRow - 1, 10).getValues();
    var themes = {}; var totals = { total: 0, errors: 0, warns: 0, infos: 0, decided: 0, fixApplied: 0, pending: 0 };
    data.forEach(function(row) {
        var theme = row[0]; var severity = row[2]; var humanDecision = row[8];
        if (!themes[theme]) themes[theme] = { errors: 0, warns: 0, decided: 0, pending: 0, fixApplied: 0 };
        totals.total++;
        if (severity.indexOf('ERROR') !== -1) { totals.errors++; themes[theme].errors++; } else if (severity.indexOf('WARN') !== -1) { totals.warns++; themes[theme].warns++; } else { totals.infos++; }
        if (humanDecision && humanDecision.length > 0) { totals.decided++; themes[theme].decided++; if (humanDecision.indexOf('fix applied') !== -1) { totals.fixApplied++; themes[theme].fixApplied++; } }
        else { if (severity.indexOf('INFO') === -1 || row[1].indexOf('VERIFY') !== -1) { totals.pending++; themes[theme].pending++; } }
    });
    var lines = ['📊 REVIEW PROGRESS', '', 'Total issues: ' + totals.total, '🔴 Errors: ' + totals.errors, '🟡 Warnings: ' + totals.warns, '🟢 Info/Verify: ' + totals.infos, '', 'Decisions made: ' + totals.decided + '/' + totals.total, 'Fixes applied: ' + totals.fixApplied, 'Still pending: ' + totals.pending, '', '--- PER THEME ---'];
    var themeNames = Object.keys(themes).sort();
    themeNames.forEach(function(t) { var th = themes[t]; var status = th.pending === 0 ? '✅' : (th.pending <= 2 ? '🟡' : '🔴'); lines.push(status + ' ' + t + ': ' + th.errors + ' err, ' + th.warns + ' warn, ' + th.decided + ' decided, ' + th.fixApplied + ' fixed' + (th.pending > 0 ? ', ' + th.pending + ' PENDING' : '')); });
    SpreadsheetApp.getUi().alert(lines.join('\n'));
}

// ============================================
// WP IMPORT
// ============================================

function importToWP() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var row = sheet.getActiveRange().getRow();
    if (row < 2) { SpreadsheetApp.getUi().alert('Select a data row (row 2+)'); return; }
    var themeName = sheet.getRange(row, COL.THEME_NAME).getValue();
    var jsonOutput = sheet.getRange(row, COL.STEP3_OUTPUT).getValue();
    if (!jsonOutput) { SpreadsheetApp.getUi().alert('No JSON in column F.'); return; }
    var postId = sheet.getRange(row, COL_WP_POST_ID).getValue();
    if (!postId) { SpreadsheetApp.getUi().alert('No WP_POST_ID in column L for ' + themeName + '.\nCreate the theme-profile in WP Admin first, then paste the post ID into column L.'); return; }

    var endpoint = WP_API_URL + '/wpagent/v1/theme-profile/import';
    var payload = JSON.stringify({
        post_id: parseInt(postId, 10),
        fields: JSON.parse(jsonOutput),
        source: 'pipeline'
    });

    try {
        var response = UrlFetchApp.fetch(endpoint, {
            method: 'POST',
            contentType: 'application/json',
            headers: { 'Authorization': 'Basic ' + WP_API_TOKEN },
            payload: payload,
            muteHttpExceptions: true
        });
        var statusCode = response.getResponseCode();
        var responseText = response.getContentText();
        if (statusCode < 200 || statusCode >= 300) {
            SpreadsheetApp.getUi().alert('❌ Import failed: ' + themeName + '\nHTTP ' + statusCode + '\n' + responseText.substring(0, 500));
            return;
        }
        var result = JSON.parse(responseText);
        var skippedInfo = (result.skipped_fields && result.skipped_fields.length > 0)
            ? '\nSkipped (overrides): ' + result.skipped_fields.join(', ') : '';
        SpreadsheetApp.getUi().alert('✅ Imported: ' + themeName + '\nPost ID: ' + postId +
            (result.fields_written ? '\nFields written: ' + result.fields_written : '') + skippedInfo);
    } catch (e) { SpreadsheetApp.getUi().alert('❌ Error: ' + e.message); }
}

function importAllToWP() {
    var ui = SpreadsheetApp.getUi();
    var confirm = ui.alert('Import All to WP',
        'Import all themes with JSON in column F and post ID in column L?\nThemes without post ID will be skipped.\nExisting manual overrides in WP will be respected.',
        ui.ButtonSet.YES_NO);
    if (confirm !== ui.Button.YES) return;

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var lastRow = sheet.getLastRow();
    var imported = 0, skipped = 0, noId = 0, errors = 0;
    var report = [];
    var endpoint = WP_API_URL + '/wpagent/v1/theme-profile/import';

    for (var row = 2; row <= lastRow; row++) {
        var themeName = sheet.getRange(row, COL.THEME_NAME).getValue();
        var jsonOutput = sheet.getRange(row, COL.STEP3_OUTPUT).getValue();
        if (!themeName || !jsonOutput) { skipped++; continue; }

        var postId = sheet.getRange(row, COL_WP_POST_ID).getValue();
        if (!postId) {
            noId++;
            report.push('⏭️ ' + themeName + ': no WP_POST_ID in col L');
            continue;
        }

        var payload = JSON.stringify({
            post_id: parseInt(postId, 10),
            fields: JSON.parse(jsonOutput),
            source: 'pipeline'
        });

        try {
            var response = UrlFetchApp.fetch(endpoint, {
                method: 'POST',
                contentType: 'application/json',
                headers: { 'Authorization': 'Basic ' + WP_API_TOKEN },
                payload: payload,
                muteHttpExceptions: true
            });

            var statusCode = response.getResponseCode();
            if (statusCode < 200 || statusCode >= 300) {
                errors++;
                report.push('❌ ' + themeName + ': HTTP ' + statusCode);
                continue;
            }

            var result = JSON.parse(response.getContentText());
            if (result.error) {
                errors++;
                report.push('❌ ' + themeName + ': ' + result.error);
                continue;
            }

            imported++;
            var skippedFields = (result.skipped_fields && result.skipped_fields.length > 0)
                ? ' (overrides: ' + result.skipped_fields.join(', ') + ')' : '';
            report.push('✅ ' + themeName + ' → ID ' + postId + skippedFields);

        } catch (e) {
            errors++;
            report.push('❌ ' + themeName + ': ' + e.message);
        }

        Utilities.sleep(500);
    }

    ui.alert(
        '📤 Import Complete\n\n' +
        'Imported: ' + imported + '\n' +
        'Skipped (no JSON): ' + skipped + '\n' +
        'Skipped (no post ID): ' + noId + '\n' +
        'Errors: ' + errors + '\n\n' +
        report.join('\n')
    );
}

function fetchPostIDs() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var lastRow = sheet.getLastRow();
    var found = 0, notFound = 0;

    for (var row = 2; row <= lastRow; row++) {
        var themeName = sheet.getRange(row, COL.THEME_NAME).getValue();
        if (!themeName) continue;
        if (sheet.getRange(row, COL_WP_POST_ID).getValue()) { found++; continue; } // already has ID

        var url = WP_API_URL + '/wp/v2/theme-profiles?search=' + encodeURIComponent(themeName) + '&per_page=1';
        try {
            var response = UrlFetchApp.fetch(url, {
                headers: { 'Authorization': 'Basic ' + WP_API_TOKEN },
                muteHttpExceptions: true
            });
            var results = JSON.parse(response.getContentText());
            if (results.length > 0) {
                sheet.getRange(row, COL_WP_POST_ID).setValue(results[0].id);
                found++;
            } else {
                notFound++;
            }
        } catch (e) { notFound++; }
        Utilities.sleep(300);
    }

    SpreadsheetApp.getUi().alert('Post IDs fetched!\nFound: ' + found + '\nNot found: ' + notFound);
}

// ============================================
// END OF PIPELINE v3.20.3 + Validation v1.1 + Import
// ============================================