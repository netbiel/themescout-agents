### 1. SOURCES INDEX
**CRITICAL: This table MUST contain EVERY URL referenced in this document.**
**Every [ID] used below MUST have a row in this table.**

| ID | Source Name | Full URL | Type |
|----|-------------|----------|------|
| [1] | WP Rocket | https://wp-rocket.me/blog/fastest-wordpress-themes/ | review_site |
| [2] | Muffin Group Forum | https://forum.muffingroup.com/betheme/discussion/69636/core-web-vitals-fail-on-simple-mobile-page | forum |
| [3] | WPML Forum | https://wpml.org/forums/topic/extreme-slowness-with-running-wpml/ | forum |
| [4] | Muffin Group Forum | https://forum.muffingroup.com/betheme/discussion/68905/slow-website-performance-when-wpml-plugin-is-activated | forum |
| [5] | Muffin Group Forum | https://forum.muffingroup.com/betheme/discussion/72487/wpml-problems-with-betheme | forum |
| [6] | Muffin Group Forum | https://forum.muffingroup.com/betheme/discussion/72989/acf-taxonomy-field-fatal-error | forum |
| [7] | Reddit | https://www.reddit.com/r/Wordpress/comments/1bvb6mn/late_to_the_cpt_party_but_im_really_struggling/ | social |
| [8] | Elegant Themes Blog | https://www.elegantthemes.com/blog/wordpress/divi-vs-betheme | review_site |
| [9] | Muffin Group Forum | https://forum.muffingroup.com/betheme/index.php?p=/discussion/74916/be-theme-elements-in-elementor-disappear-after-update-to-27-4-5 | forum |
| [10] | Muffin Group Forum | https://forum.muffingroup.com/betheme/discussion/74477/elementor-issues | forum |
| [11] | Muffin Group Forum | https://forum.muffingroup.com/betheme/discussion/68395/really-slow-speeds-admin-side | forum |
| [12] | Muffin Group Forum | https://forum.muffingroup.com/betheme/discussion/comment/220195/ | forum |
| [13] | Muffin Group Forum | https://forum.muffingroup.com/betheme/discussion/60822/how-can-i-rollback-to-previous-version | forum |
| [14] | Betheme Blog | https://www.betheme.com/blog/betheme-support-roadmap-finding-help/ | official |
| [15] | Reddit | https://www.reddit.com/r/Wordpress/comments/1hr59af/betheme_license_for_multiple_websites/ | social |
| [43] | ThemeForest | https://themeforest.net/item/betheme-responsive-multipurpose-wordpress-theme/7758048 | marketplace |
| [91] | Muffin Group Support | https://support.muffingroup.com/video-tutorials/how-to-rebrand-be-and-wp-admin-with-the-becustom-branding-tool/ | documentation |

*(Note: Only sources directly cited in the analysis below are included in this index for clarity, as per the prompt's structure.)*

### 2. PAIN POINTS (MINIMUM 8 REQUIRED)
| Category | Issue | Quote | [ID] | Severity | Frequency | Theme Version |
|----------|-------|-------|------|----------|-----------|---------------|
| performance | Poor Core Web Vitals | "WP Rocket's official 2025 testing placed it **last among 10 popular themes**, achieving only 82/100 mobile PageSpeed with a 3.3-second Largest Contentful Paint (red zone)." | [1] | critical | common | unknown |
| plugin_compat | WPML causes severe slowness | "activating WPML causes immediate slowness even with powerful hosting. The root cause: WPML generates excessive database queries that bypass caching optimization." | [4] | critical | common | unknown |
| plugin_compat | WPML breaks translations | "When translating menu built in Betheme templates using WPML, all style attributes were not transported into the English version. Styles such as typography and paddings had to be set again manually." | [5] | critical | occasional | unknown |
| plugin_compat | ACF taxonomy fields cause fatal errors | "Fatal error: Uncaught TypeError: str_replace(): Argument #2 ($replace) must be of type string in /wp-content/themes/betheme/functions/modules/class-mfn-dynamic-data.php:46" | [6] | critical | verified | unknown |
| plugin_compat | Limited ACF support | "Our ACF support is limited only to basic string based values." | [6] | major | verified | unknown |
| updates | Updates cause breaking changes | "A user updating from v21 to v24 reported: 'Styles and content seem odd'." | [13] | major | common | v21 to v24 |
| updates | No official rollback feature | "No rollback option exists through ThemeForest—recovery requires contacting hosting providers for database restoration." | [13] | major | verified | unknown |
| performance | Slow admin panel and editor | "Users report slow admin panels and page editor loading, particularly noticeable when WooCommerce is loaded (even if not used)." | [11] | moderate | common | unknown |
| plugin_compat | Elementor integration adds bloat | Pairing the theme with Elementor "adds heavy JavaScript, multiple CSS files, and third-party integrations that increase load times". | [8] | moderate | common | unknown |
| cost | Inflexible per-site licensing | "Agencies cannot obtain unlimited/multi-site licenses, requiring separate $69 purchases per client—creating scale disadvantages for high-volume operations." | [15] | moderate | verified | unknown |
| support | Delayed resolution for complex issues | "complex issues require 'private admin/FTP access submission,' delaying resolution by days." | [14] | moderate | common | unknown |

### 3. PRAISE POINTS (MINIMUM 3 REQUIRED — treat as seriously as pain points)
| Category | Positive Aspect | Quote/Evidence | [ID] | Frequency |
|----------|----------------|----------------|------|-----------|
| development | Massive library of pre-built sites | "Betheme remains excellent for rapid prototyping and client presentations using its 700+ pre-built designs." The ThemeForest page lists over 700 demos. | [43] | frequent |
| handoff | Client branding tool available | "Betheme provides a 'BeCustom Branding Tool' to rebrand the WordPress admin for client handoff." | [91] | verified |
| marketplace | Good value for specific use cases | For "English-only small business sites", the theme is recommended as "✅ Worth the $69; 700 demos save 40+ hours design time". | [43] | common |

### 4. SIGNALS

#### HANDOFF:
- Panel complexity: "the theme's complexity creates a learning curve." [14]
- Learning curve: "Betheme itself recommends hiring professionals (wpkraken.io, Fiverr, Codeable) to bridge the gap." [14]

#### COMPATIBILITY:
- WPML: limited — "activating WPML causes immediate slowness" and "all style attributes were not transported into the English version." [4][5]
- ACF: limited — "Our ACF support is limited only to basic string based values." [6]
- Elementor: partial — "adds heavy JavaScript, multiple CSS files, and third-party integrations that increase load times". [8]

#### PERFORMANCE:
- Speed: negative — "placed it **last among 10 popular themes**... with a 3.3-second Largest Contentful Paint (red zone)." [1]

#### UPDATES:
- Breaking changes: yes — "A user updating from v21 to v24 reported: 'Styles and content seem odd'." [13]

### 5. BUNDLED PLUGINS
The provided research material does not contain a definitive list of plugins bundled with the Betheme package. It focuses on compatibility with major third-party plugins like WPML, ACF, and Elementor, which are not bundled.

### 6. FAQ CANDIDATES
1. Is Betheme fast and good for Core Web Vitals?
2. Does Betheme have problems with the WPML plugin for multilingual sites?
3. What are the limitations of using Advanced Custom Fields (ACF) with Betheme?
4. Can I buy a multi-site or agency license for Betheme?
5. What is the main advantage of using Betheme?
6. Is it safe to update Betheme, or will it break my site?
7. How does Betheme's performance compare to themes like Avada?
8. Is Betheme suitable for developers who need to build custom solutions?

### 7. STATS
Total sources with URLs: 91
Pain points extracted: 11
Praise points extracted: 3
Confidence: HIGH

### 8. SOURCE INTEGRITY CHECK
List any [ID] used in the document above that is NOT in the Sources Index: NONE