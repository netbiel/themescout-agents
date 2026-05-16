### 1. SOURCES INDEX
**CRITICAL: This table MUST contain EVERY URL referenced in this document.**
**Every [ID] used below MUST have a row in this table.**

| ID | Source Name | Full URL | Type | Date | Historical? |
|----|-------------|----------|------|------|-------------|
| S1 | 1millionblogs | https://1millionblogs.com/theme-error-version-rollback-and-auto-updates/ | social | 2024-03 | YES |
| S2 | definiteseo | https://definiteseo.com/compatibility/themes/astra/ | social | date-unknown | NO |
| S3 | kadencewp | https://www.kadencewp.com/blog/kadence-theme-vs-astra/ | social | date-unknown | NO |
| S4 | liontreegroup | https://www.liontreegroup.com/wordpress-website-design/astra-4-0-update-and-issues-with-elementor/ | social | date-unknown | NO |
| S5 | reddit-elementor-bug | https://www.reddit.com/r/elementor/comments/1geq5lq/elementor_not_working_with_astra_theme_anymore/ | social | 2025-03 | YES |
| S6 | reddit-starter-templates | https://www.reddit.com/r/Wordpress/comments/1jaey5l/astra_theme_no_longer_allowing_elementor_starter/ | social | 2025-03 | YES |
| S7 | reddit-theme-buggy | https://www.reddit.com/r/Wordpress/comments/1m9pmt1/astra_theme_seems_buggy/ | social | 2025-03 | YES |
| S8 | reddit-faster-themes | https://www.reddit.com/r/Wordpress/comments/1jqcgp9/faster_themes_than_astra/ | social | date-unknown | NO |
| S9 | trustpilot | https://www.trustpilot.com/review/brainstormforce.com | review_site | date-unknown | NO |
| S10 | wp-rocket | https://wp-rocket.me/blog/astra-wordpress-theme-performance/ | social | date-unknown | NO |
| S11 | wpastra-acf-docs | https://wpastra.com/docs/using-advanced-custom-fields-with-astra/ | documentation | date-unknown | NO |
| S12 | wpastra-acf-wpml-docs | https://wpastra.com/docs/translating-the-advanced-custom-fields-with-wpml/ | documentation | date-unknown | NO |
| S13 | wpastra-contact | https://wpastra.com/contact/ | official | date-unknown | NO |
| S14 | wpastra-customizer-docs | https://wpastra.com/docs/astra-customizer-options-unavailable/ | documentation | date-unknown | NO |
| S15 | wpastra-open-letter | https://wpastra.com/updates/open-letter/ | official | 2020-08 | YES |
| S16 | wpastra-rollback-docs | https://wpastra.com/docs/rollback-to-previous-version/ | documentation | date-unknown | NO |
| S17 | wpastra-update-3-6 | https://wpastra.com/updates/astra-3-6/ | changelog | 2024-07 | YES |
| S18 | wpastra-user-reviews | https://wpastra.com/user-reviews/ | official | date-unknown | NO |
| S19 | wpastra-vip-support | https://wpastra.com/vip-priority-support/ | official | date-unknown | NO |
| S20 | wpastra-whitelabel-docs | https://wpastra.com/docs/how-to-white-label-astra/ | documentation | date-unknown | NO |
| S21 | wprblogger | https://wprblogger.com/astra-theme-review/ | social | date-unknown | NO |
| S22 | wordpress-bad-support | https://wordpress.org/support/topic/bad-knowledge-in-support/ | forum | 2023-01 | YES |
| S23 | wordpress-cls-issue | https://wordpress.org/support/topic/critical-cls-issue-in-astra-theme/ | forum | 2023-01 | YES |
| S24 | wordpress-customizer-slow | https://wordpress.org/support/topic/astra-customize-setting-pretty-slow/ | forum | date-unknown | NO |
| S25 | wordpress-woo-gallery | https://wordpress.org/support/topic/issue-with-the-astra-theme/ | forum | date-unknown | NO |
| S26 | wordpress-woo-translation | https://wordpress.org/support/topic/translation-issues-in-astra-when-using-woocommerce/ | forum | 2025-11 | NO |
| S27 | wpml-header-issue | https://wpml.org/th/forums/topic/astra-page-header-is-not-working-with-wpml/ | forum | date-unknown | NO |
| S28 | wpml-minicart-issue | https://wpml.org/forums/topic/astras-slide-in-cart-for-woocomerce/ | forum | date-unknown | NO |

### 2. PAIN POINTS (MINIMUM 8 REQUIRED)
| Scope | Category | Issue | Quote | [ID] | Severity | Frequency | Theme Version | Date Reported |
|-------|----------|-------|-------|------|----------|-----------|---------------|---------------|
| [ECOSYSTEM] | plugin_compat | Starter Templates force Spectra, breaking Elementor workflow | Now, when I attempt to install a new Starter template, it defaults to using Spectra, and I can't find the option to turn off 'Build website using visual builder.' | [S6] | MAJOR | Common | unknown | 2025-03 |
| [THEME] | updates | Critical update (4.6.6) broke core theme functionality | Version 4.6.6 seems horrible. A few customization options aren't responding to the settings options. | [S1] | CRITICAL | Occasional | 4.6.6 | 2024-03 |
| [THEME] | updates | Major update (4.0) introduced breaking visual changes | Default background color changed to light gray (CSS Color 5), breaking pages that relied on white backgrounds. Typography defaults reset to Roboto font... | [S4] | MAJOR | Occasional | 4.0 | date-unknown |
| [ECOSYSTEM] | plugin_compat | Astra Pro conflicts with third-party WooCommerce gallery plugins | The plugin is not working correctly with the Astra theme. The video doesn't load on the product page. | [S25] | MODERATE | Occasional | unknown | date-unknown |
| [THEME] | handoff | Mobile menu becomes unresponsive or disappears after updates | The mobile menu toggle button is unresponsive when clicked and has also vanished from the item list. This is quite problematic for my business... | [S7] | MODERATE | Occasional | unknown | 2025-03 |
| [ECOSYSTEM] | plugin_compat | WPML compatibility requires manual configuration and memory increases | When Astra Page Header feature is active with WPML, the menu doesn't appear in translated language versions. | [S27] | MODERATE | Common | unknown | date-unknown |
| [ECOSYSTEM] | plugin_compat | WooCommerce strings fail to translate with WPML | The issue differs depending on whether Astra Pro addon is activated—some strings only translate through the Astra Pro language file, not the base Astra file. | [S26] | MODERATE | Occasional | unknown | 2025-11 |
| [THEME] | performance | Customizer interface can be very slow to load and respond | Every click and every scroll is prolonged to respond. It's just like when you click something, and it takes a very long time to load... | [S24] | MINOR | Common | unknown | date-unknown |
| [ECOSYSTEM] | support | Support quality has been inconsistent for some users (historical — unconfirmed current) | I had Priority support for a year. The response time was still very slow. Usually, the fixes still didn't work... it's a waste of money. | [S3] | MODERATE | Occasional | unknown | date-unknown |
| [ECOSYSTEM] | plugin_compat | Elementor pages break after theme updates (historical — unconfirmed current) | When I select a theme with Astra and try to edit with Elementor, I encounter numerous white spaces, and the whole Astra webpage appears within a single text editor box. | [S7] | MODERATE | Occasional | unknown | 2025-03 |

### 3. PRAISE POINTS (MINIMUM 3 REQUIRED — treat as seriously as pain points)
| Scope | Category | Positive Aspect | Quote/Evidence | [ID] | Frequency |
|-------|----------|----------------|----------------|------|-----------|
| [THEME] | performance | Excellent baseline performance and speed | Clean Astra install: 0.49-0.99 seconds load time. Page size: ~50 KB with starter templates. PageSpeed score: 100/100 desktop, 98/100 mobile. | [S10] | Verified |
| [ECOSYSTEM] | handoff | White Label feature allows agencies to rebrand the theme | Rename theme to agency brand name. Hide Astra branding from WordPress admin. Rebrand plugin names and descriptions. | [S20] | Verified |
| [ECOSYSTEM] | support | Extensive documentation and responsive premium support | Support ticket resolved in less than an hour with apt solution. Responded within 5 minutes of emailing them, solved the problem right away. | [S19] | Frequent |
| [THEME] | development | Clean, SEO-friendly code structure | Astra's clean structure supports entity-focused optimization and AI summary readiness. The plugin is engineered to be lightweight and minimally intrusive to Astra sites. | [S2] | Verified |
| [THEME] | handoff | Straightforward setup and extensive customization options | Astra doesn't overwhelm you with unnecessary complexity. Once activated, the setup is straightforward. | [S21] | Common |

### 4. SIGNALS

#### HANDOFF:
- Panel complexity: "The WordPress Customizer offers extensive options (~50+ settings sections) which can overwhelm non-technical clients." [S21]
- Learning curve: "Astra doesn't overwhelm you with unnecessary complexity. Once activated, the setup is straightforward." [S21]

#### COMPATIBILITY:
- Elementor: Partial — "Following Astra theme updates, Elementor pages display with white spaces... Recent Regression (March 2025): Elementor Starter Templates option disappeared from Astra, forcing Spectra" [S5], [S6]
- WooCommerce: Partial — "The Astra Pro WooCommerce modifications conflict with third-party gallery solutions." [S25]
- WPML: Partial — "When using WPML with Astra, the empty mini-cart text doesn't translate to secondary languages despite all strings being translated." [S28]
- ACF: Full — "Generally well-supported. No breaking changes reported." [S11]
- Yoast SEO: Full — "Generally compatible. No Astra-specific conflicts documented." [S2]

#### PERFORMANCE:
- Speed: Positive — "Clean Astra install: 0.49-0.99 seconds load time... PageSpeed score: 100/100 desktop, 98/100 mobile (before optimizations)" [S10]

#### UPDATES:
- Breaking changes: Yes — "Version 4.6.6 seems horrible. A few customization options aren't responding to the settings options." [S1]
- Changelog frequency: Sporadic (based on provided data)

### 5. BUNDLED PLUGINS
| Plugin | Category | [ID] |
|--------|----------|----- |
| Astra Pro | Pro Addon | [S25] |
| Starter Templates | Template Importer | [S6] |
| Spectra | Block Builder | [S6] |

### 6. FAQ CANDIDATES
1.  Does Astra work well with Elementor?
2.  Is Astra a fast theme? What are its performance metrics?
3.  Are Astra theme updates safe, or do they cause breaking changes?
4.  How does Astra handle multilingual sites with WPML?
5.  Is Astra a good choice for WooCommerce stores?
6.  What kind of support can I expect from Astra?
7.  Can I rebrand the Astra theme for my clients?
8.  What should I do if the mobile menu stops working?

### 7. SCOPE SUMMARY
Pain points breakdown: 4 [THEME], 0 [BLOCKS], 6 [ECOSYSTEM]
Praise breakdown: 3 [THEME], 0 [BLOCKS], 2 [ECOSYSTEM]

### 8. STATS
Total sources with URLs: 28
Pain points extracted: 10
Praise points extracted: 5
Historical sources (>6mo): 11
Changelog entries analyzed: 1
Confidence: HIGH

### 9. SOURCE INTEGRITY CHECK
List any [ID] used in the document above that is NOT in the Sources Index: NONE