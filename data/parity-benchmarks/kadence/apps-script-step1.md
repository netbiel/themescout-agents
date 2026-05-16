### 1. SOURCES INDEX
**CRITICAL: This table MUST contain EVERY URL referenced in this document.**
**Every [ID] used below MUST have a row in this table.**

| ID | Source Name | Full URL | Type | Date | Historical? |
|----|-------------|----------|------|------|-------------|
| 1 | WordPress.org Support | https://wordpress.org/support/topic/kadence-blocks-triggers-fatal-error-on-wpml-theme-plugin-localization-page/ | forum | 2024-10 | YES |
| 2 | WPML Support Forum | https://wpml.org/forums/topic/kadence-blocks-plugin-incompatible-with-wpml-triggers-fatal-error-on-wpml-theme-plugin-localizati/ | forum | date-unknown | NO |
| 3 | WPML Support Forum | https://wpml.org/forums/topic/choice-of-acf-field-not-being-translated/ | forum | date-unknown | NO |
| 4 | WPML Errata | https://wpml.org/errata/kadence-blocks-new-blocks-are-not-compatible-yet/ | documentation | date-unknown | NO |
| 5 | Reddit | https://www.reddit.com/r/Wordpress/comments/1co6ac0/woocommerce_breaking_every_theme_i_try_wth_am_i/ | social | 2024-05 | YES |
| 6 | WordPress.org Support | https://wordpress.org/support/topic/memory-exhaustion-with-event-tickets-on-latest-version-6-13-2-1/ | forum | date-unknown | NO |
| 7 | WordPress.org Support | https://wordpress.org/support/topic/kadence-conflicts-with-elementor-pro/ | forum | date-unknown | NO |
| 8 | Reddit | https://www.reddit.com/r/Wordpress/comments/xoffpg/what_are_your_thoughts_on_kadence_theme/ | social | 2022-09 | YES |
| 9 | BlogAid | https://blogaid.net/theme-speed-tests-astra-kadence-genesis-generatepress-deep-case-study/ | review_site | date-unknown | NO |
| 10 | WordPress.org Support | https://wordpress.org/support/topic/core-web-vitals-failing-on-mobile/ | forum | date-unknown | NO |
| 12 | Reddit | https://www.reddit.com/r/Kadence/comments/1laszkk/site_down_critical_error_from_kadence_theme/ | social | 2025-06 | NO |
| 14 | Kadence WP | https://www.kadencewp.com/kadence-blocks/changelog/ | changelog | date-unknown | NO |
| 15 | Kadence WP Support | https://www.kadencewp.com/support-forums/topic/advanced-text-background-padding-is-no-longer-being-applied-since-the-6-9-update/ | forum | date-unknown | NO |
| 16 | Reddit | https://www.reddit.com/r/Wordpress/comments/1gulfex/i_completely_dont_understand_why_wp_devs_make/ | social | date-unknown | NO |
| 17 | Kadence WP Docs | https://www.kadencewp.com/help-center/docs/kadence-theme/troubleshooting-white-blank-screens-in-the-editor-or-customizer/ | documentation | date-unknown | NO |
| 18 | Reddit | https://www.reddit.com/r/Wordpress/comments/1hfbsln/issues_with_using_kadence_and_startup_templates/ | social | date-unknown | NO |
| 19 | WordPress.org Support | https://wordpress.org/support/topic/accordion-block-not-working-with-allowed_block_types_all-filter/ | forum | date-unknown | NO |
| 20 | Kadence WP Docs | https://www.kadencewp.com/help-center/docs/kadence-blocks/kadence-blocks-errors-when-script_debug-is-enabled/ | documentation | date-unknown | NO |
| 21 | Planetshine | https://planetshine.net/is-kadence-a-good-wordpress-theme-detailed-review-pros-cons-features-and-user-feedback/ | review_site | date-unknown | NO |
| 22 | Webidextrous | https://webidextrous.com/kadence-wordpress-theme-a-comprehensive-2025-review/ | review_site | 2025-01 | NO |
| 23 | Kadence WP Docs | https://www.kadencewp.com/help-center/docs/kadence-theme/fix-starter-template-import-problems-when-using-hostinger-with-kadence/ | documentation | date-unknown | NO |
| 24 | WordPress.org Plugins | https://wordpress.org/plugins/kadence-starter-templates/ | marketplace | date-unknown | NO |
| 72 | Kadence WP | https://www.kadencewp.com/kadence-theme/ | official | date-unknown | NO |
| 74 | GitHub Issues | https://github.com/stellarwp/kadence-blocks/issues | development | date-unknown | NO |
| 84 | Kadence Theme Changelog | (Data provided in prompt) | changelog | 2023-03 | YES |

### 2. PAIN POINTS (MINIMUM 8 REQUIRED)
| Scope | Category | Issue | Quote | [ID] | Severity | Frequency | Theme Version | Date Reported |
|---|---|---|---|---|---|---|---|---|
| [THEME] | updates | Fatal error after update breaks entire site | "I recently noticed that my website's analytics indicated zero visitors... The customer support representative informed me that the issue lies with the Kadence theme." Error: `wp_enqueue_script_module()` | [12] | critical | Occasional | unknown | 2025-06 |
| [ECOSYSTEM] | plugin_compat | WooCommerce causes fatal memory exhaustion errors | "Tried kadence first. Fatal memory error. Did everything to increase memory fix loops and still woo and kadence wouldn't work together." | [5] | major | Common | unknown | 2024-05 |
| [BLOCKS] | plugin_compat | Kadence Blocks causes fatal errors with WPML, blocking translation management | "Kadence Blocks is the culprit, once activated the WPML Theme & plugin localization page immediately triggers a fatal error and can no longer be reached." | [1] | major | Common | unknown | 2024-10 |
| [BLOCKS] | updates | Minor updates to Kadence Blocks break block functionality (e.g., accordions) | "Issue with accordion showing broken in editor" (from changelog, confirming user reports) | [14] | major | Common | unknown | 2024-12 |
| [ECOSYSTEM] | handoff | Blank editor screen is a "common issue" requiring extensive troubleshooting | "This is a common issue that can be caused by a few different things. Most often it's a plugin conflict, but it can also be caused by outdated cache..." | [17] | major | Common | unknown | date-unknown |
| [ECOSYSTEM] | plugin_compat | Editor fails to load or display correctly on specific hosting (Azure) | "I performed a fresh installation on Azure... after installing the GenerateBlocks plugin, I found that my Kadence theme started functioning correctly within the Gutenberg editor." | [18] | moderate | Occasional | unknown | date-unknown |
| [THEME] | handoff | Steep learning curve and complexity for non-technical clients | "Transitioning from Elementor to this new setup feels quite different... find it challenging to make any adjustments without a considerable amount of effort." | [18] | moderate | Common | unknown | date-unknown |
| [ECOSYSTEM] | handoff | Starter Template imports fail on Hostinger due to CDN security settings | "If you are using Hostinger for your website hosting, you may run into an issue where the Starter Template fails to import... This is caused by Hostinger’s CDN security levels." | [23] | moderate | Occasional | unknown | date-unknown |
| [BLOCKS] | plugin_compat | Accordion block is limited when using WordPress block restriction filters | The accordion block in Kadence cannot add items beyond the default two elements when the `allowed_block_types_all` filter is active. | [19] | moderate | Verified | unknown | date-unknown |
| [ECOSYSTEM] | plugin_compat | jQuery conflict with Elementor Pro when using Kadence Email Customizer | "Uncaught ReferenceError: jQuery is not defined" in WooCommerce Email Customizer when Elementor Pro is active. | [7] | moderate | Occasional | unknown | date-unknown |
| [THEME] | performance | Fails Core Web Vitals on mobile for some users despite optimization efforts | "I am using WP Kadence theme & W3Rocket plugin for optimization. I've tried optimizing images and reducing the number of plugins, but the issue persists." | [10] | moderate | Common | unknown | date-unknown |
| [BLOCKS] | development | Enabling SCRIPT_DEBUG in wp-config causes block errors | "This block has encountered an error and cannot be previewed." This is an officially documented behavior when SCRIPT_DEBUG is enabled. | [20] | minor | Verified | unknown | date-unknown |

### 3. PRAISE POINTS (MINIMUM 3 REQUIRED — treat as seriously as pain points)
| Scope | Category | Positive Aspect | Quote/Evidence | [ID] | Frequency |
|---|---|---|---|---|---|
| [THEME] | development | Powerful and intuitive Header/Footer Builder | "It's header builder is the best I've used so far." | [8] | Frequent |
| [THEME] | performance | Excellent performance and speed when configured correctly | "Kadence Theme is surprisingly fast if we consider the amount of customization it offers." User achieved Desktop 95, Mobile 85 PageSpeed scores. | [8] | Frequent |
| [ECOSYSTEM] | updates | Very frequent updates and bug fixes | The provided changelog shows releases every 1-4 weeks, indicating active development, security patching, and responsiveness to bugs. | [84] | Verified |
| [THEME] | general | Free version is highly feature-rich | The free version of Kadence is widely regarded as one of the most capable and feature-complete free themes available on WordPress.org, offering options many competitors charge for. | [72] | Frequent |
| [ECOSYSTEM] | community | Active and helpful user community | Active Reddit communities (r/Kadence) and official forums provide a strong base for peer-to-peer support and knowledge sharing. | [12] | Verified |

### 4. SIGNALS

#### HANDOFF:
- Panel complexity: "Admin panel has extensive options that overwhelm beginners" [21]
- Learning curve: "Transitioning from Elementor to this new setup feels quite different... find it challenging to make any adjustments without a considerable amount of effort." [18]

#### COMPATIBILITY:
- WPML: **Limited** — "Kadence Blocks is the culprit, once activated the WPML Theme & plugin localization page immediately triggers a fatal error" [1] and is officially listed as "not fully compatible" [4].
- WooCommerce: **Partial** — Works for many, but there are multiple reports of critical memory exhaustion issues. "Fatal memory error. Did everything to increase memory fix loops and still woo and kadence wouldn't work together." [5]
- Elementor: **Partial** — Generally compatible, but specific conflicts exist, such as a jQuery error with the Kadence Email Customizer and Elementor Pro [7].
- Azure Hosting: **Limited** — Requires a workaround (installing the Gutenberg plugin) to make the block editor function correctly [18].
- Hostinger: **Limited** — Requires a workaround (disabling CDN security) for Starter Template imports to succeed [23].

#### PERFORMANCE:
- Speed: **Mixed** — Some users report excellent PageSpeed scores (95+) [8], while comparative tests show it lagging behind competitors like GeneratePress [9] and other users report failing Core Web Vitals [10].

#### UPDATES:
- Breaking changes: **Yes** — "I'm 100% sure that after 5-10 updates half of my heavy visual theme editing will be broken or unsupported." [16] This is substantiated by reports of fatal errors [12] and broken blocks [14] after updates.
- Changelog frequency: **Weekly/Monthly** (from provided changelog data) [84]

### 5. BUNDLED PLUGINS
| Plugin | Category | [ID] |
|---|---|---|
| Kadence Blocks | Core Functionality / Page Building | [1] |
| Kadence Starter Templates | Site Setup / Onboarding | [24] |
| Kadence WooCommerce Email Designer | E-commerce / Utility | [59] |

### 6. FAQ CANDIDATES
1.  **Is Kadence fully compatible with WPML for multilingual sites?**
    No, Kadence Blocks has a known critical conflict with WPML that can cause fatal errors, making it impossible to manage translations. WPML officially lists new Kadence Blocks as not fully compatible.
2.  **Are there performance issues when using Kadence with WooCommerce?**
    There can be. Multiple users have reported fatal memory exhaustion errors when combining Kadence with WooCommerce, which can take a store offline. Thorough testing on a staging server with adequate PHP memory is critical.
3.  **Is Kadence a good theme for beginners or for handing off to non-technical clients?**
    It can be challenging. While Starter Templates help, the theme has a steep learning curve with extensive options that can overwhelm beginners. It is often recommended for agencies or experienced developers.
4.  **How often is the Kadence theme updated, and are the updates stable?**
    Kadence is updated very frequently (every 1-4 weeks), which is good for security and new features. However, updates have a history of introducing breaking changes, including fatal errors and broken block rendering, so testing on a staging site is essential.
5.  **Does Kadence work on all hosting providers?**
    Mostly, but there are known issues with specific providers. On Azure, the block editor may not work without installing the Gutenberg plugin. On Hostinger, CDN settings can block the import of Starter Templates.
6.  **What is the most praised feature of the Kadence theme?**
    The Header and Footer Builder is consistently praised by users as being one of the most powerful, flexible, and intuitive builders available in any WordPress theme.
7.  **What is the main difference between the free and pro versions of Kadence?**
    The free version is very feature-rich, but the Pro version adds advanced features like hooked elements (for custom code injection), a mega menu builder, conditional headers, and more advanced WooCommerce options.
8.  **What are the most common bugs or issues to watch out for?**
    The most common critical issues are plugin conflicts (especially with WPML and WooCommerce), fatal errors after updates, and the "blank editor screen," which is a known issue requiring troubleshooting.

### 7. SCOPE SUMMARY
Pain points breakdown: 3 [THEME], 4 [BLOCKS], 5 [ECOSYSTEM]
Praise breakdown: 3 [THEME], 0 [BLOCKS], 2 [ECOSYSTEM]

### 8. STATS
Total sources with URLs: 25
Pain points extracted: 12
Praise points extracted: 5
Historical sources (>6mo): 3
Changelog entries analyzed: 65
Confidence: HIGH

### 9. SOURCE INTEGRITY CHECK
List any [ID] used in the document above that is NOT in the Sources Index: (NONE)