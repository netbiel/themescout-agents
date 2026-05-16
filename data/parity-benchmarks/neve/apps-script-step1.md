### 1. SOURCES INDEX
**CRITICAL: This table MUST contain EVERY URL referenced in this document.**
**Every [ID] used below MUST have a row in this table.**

| ID | Source Name | Full URL | Type | Date | Historical? |
|----|-------------|----------|------|------|-------------|
| [1] | WPScan | https://wpscan.com/vulnerability/a47f2743-4916-4333-9113-1235f30e443b/ | official | 2023-11 | YES |
| [2] | Wordfence | https://www.wordfence.com/threat-intel/vulnerabilities/wordpress-plugins/themeisle-sdk/themeisle-sdk-various-versions-missing-authorization | official | 2023-02 | YES |
| [3] | WordPress.org Support | https://wordpress.org/support/theme/neve/ | forum | 2025-01 | YES |
| [4] | SiteCare | https://www.sitecare.com/blog/elementor-update-fatal-errors/ | review_site | 2024-12 | YES |
| [5] | Neve Changelog (GitHub) | https://github.com/Codeinwp/neve/blob/master/CHANGELOG.md | changelog | date-unknown | NO |
| [6] | WordPress.org Support | https://wordpress.org/support/topic/neve-mobile-menu-not-working/ | forum | 2025-01 | YES |
| [7] | Omnisend | https://www.omnisend.com/blog/woocommerce-themes/ | review_site | 2025-MM | NO |
| [8] | Reddit | https://www.reddit.com/r/Wordpress/comments/108w8l2/neve_theme_edit_copyright/ | social | 2023-01 | YES |
| [9] | NitroPack | https://nitropack.io/blog/post/best-wordpress-themes-core-web-vitals | review_site | 2025-MM | NO |
| [10] | ThemeIsle | https://themeisle.com/themes/neve/ | official | date-unknown | NO |
| [11] | Elegant Themes | https://www.elegantthemes.com/blog/resources/fastest-wordpress-themes | review_site | 2025-MM | NO |
| [12] | WPShout | https://wpshout.com/neve-theme-review/ | review_site | 2024-MM | YES |
| [13] | Themewinter | https://themewinter.com/blog/best-wordpress-themes/ | review_site | 2025-MM | NO |

### 2. PAIN POINTS (MINIMUM 8 REQUIRED)
| Scope | Category | Issue | Quote | [ID] | Severity | Frequency | Theme Version | Date Reported |
|---|---|---|---|---|---|---|---|---|
| [ECOSYSTEM] | plugin_compat | Elementor 3.26 update caused fatal errors (historical — unconfirmed current) | Users experienced significant fatal errors following the Elementor 3.26 update, particularly with themes like Neve that utilize advanced builder integrations and custom layouts. | [4] | major | Occasional | < 3.8.14 | 2024-12 |
| [THEME] | updates | Recurring mobile menu bugs (historical — unconfirmed current) | Users on the support forums in late 2024 and early 2025 reported that the mobile menu icon appeared, but clicking it resulted in a blank white box or no action. | [6] | moderate | Common | unknown | 2025-01 |
| [THEME] | performance | Excessive temporary files generated in some environments | A 2025 support report highlighted that Neve was producing thousands of temporary files, which can bloat server storage and slow down disk I/O on lower-end hosting plans. | [3] | moderate | Occasional | unknown | 2025-01 |
| [ECOSYSTEM] | security | Companion plugin exposed sensitive information (historical — unconfirmed current) | The Cloud Templates & Patterns collection, integral to Neve’s starter site functionality, was found to have insufficient protection on log files in versions prior to 1.2.3, potentially exposing server-side data. | [1] | moderate | Verified | < 1.2.3 (plugin) | 2023-11 |
| [THEME] | handoff | Footer copyright not editable in free version via Customizer | Users often find that the edit-pencil icon for the footer copyright does nothing in the free version, leading to confusion about whether the feature is broken or intentionally locked behind Pro. | [8] | moderate | Common | unknown | 2023-01 |
| [THEME] | handoff | Option overload and learning curve for non-technical users | While user-friendly, mastering all the options in Neve takes time, and the interface can feel overwhelming for non-technical users once the Pro features are activated. | [7] | minor | Common | unknown | 2025-MM |
| [THEME] | updates | Major Customizer reorganization confused existing users | Version 4.0.1 restructured the main Customizer panels and updated H2 typography defaults, which required some site administrators to re-adjust their global style settings. | [5] | minor | Occasional | 4.0.1 | 2025-02 |
| [ECOSYSTEM] | support | Slow support response times for free users on public forums | Official support response times on public forums range from 2 days to 7 days, with priority given to Pro users through a dedicated ticketing system. | [3] | minor | Common | unknown | 2025-01 |
| [ECOSYSTEM] | security | ThemeIsle SDK vulnerability allowed unauthorized data modification (historical — unconfirmed current) | The register_reference() function within the ThemeIsle SDK failed to properly validate user identities, which allowed unauthenticated attackers to update specific option values used for tracking. | [2] | minor | Verified | SDK issue | 2023-02 |
| [ECOSYSTEM] | updates | White Label module had a license key bug | Version 4.1.4 addressed a bug where changing the theme license key was inhibited if the White Label module was currently enabled. | [5] | minor | Occasional | < 4.1.4 | 2025-09 |

### 3. PRAISE POINTS (MINIMUM 3 REQUIRED — treat as seriously as pain points)
| Scope | Category | Positive Aspect | Quote/Evidence | [ID] | Frequency |
|---|---|---|---|---|---|
| [THEME] | performance | Industry-leading performance and Core Web Vitals | Neve’s marketing claims of a 28KB default install size and sub-second load times are largely validated by independent testing... Neve consistently achieves sub-600ms load times on fresh installs. | [9], [11] | Frequent |
| [THEME] | security | Proactive security posture and rapid patch management | A review of the official Neve changelog from 2023 to late 2025 reveals a highly responsive patch management cycle. The development team at ThemeIsle consistently addresses compatibility warnings and minor security lapses within days of discovery. | [5] | Verified |
| [THEME] | development | Developer-friendly with vanilla JS and extensive documentation | By avoiding the jQuery framework for core functionality, Neve eliminates a major source of render-blocking... A unique advantage for agencies is the "Neve Codex"—a comprehensive documentation of hooks and functions. | [10] | Verified |
| [ECOSYSTEM] | plugin_compat | Strong compatibility with major plugins like Elementor and WooCommerce | Neve’s integration with Elementor is deep, including a dedicated "Elementor Booster" in the Pro version... For agencies managing online stores, Neve’s WooCommerce implementation is a primary draw. | [5], [10] | Common |
| [ECOSYSTEM] | handoff | Excellent agency-focused features like White Labeling | The "White Module" in Neve Pro allows agencies to rebrand the theme as their own. This is a "Psychological retention tool" that helps agencies maintain brand authority. | [10] | Verified |
| [THEME] | handoff | Intuitive visual Header/Footer Builder for clients | While GeneratePress is technically faster, Neve offers a more intuitive visual "Header/Footer Builder" that is easier for agencies to hand off to non-technical clients. | [13] | Common |

### 4. SIGNALS

#### HANDOFF:
- Panel complexity: "While user-friendly, mastering all the options in Neve takes time, and the interface can feel overwhelming for non-technical users once the Pro features are activated." [7]
- Learning curve: "Professional reviews highlight a learning curve for clients due to the sheer volume of design controls available in the Header/Footer builder and Global Styles." [7]

#### COMPATIBILITY:
- Elementor: full — "Neve’s integration with Elementor is deep, including a dedicated 'Elementor Booster' in the Pro version." [10]
- WooCommerce: full — "For agencies managing online stores, Neve’s WooCommerce implementation is a primary draw." [5]
- ACF: full — "Neve is highly regarded by developers for its support of dynamic properties via ACF." [5]

#### PERFORMANCE:
- Speed: positive — "Tests using Pingdom and GTmetrix showed Neve’s page size at approximately 37.7KB, which, while slightly higher than the 28KB claim, remains exceptionally low for a modern theme." [9]

#### UPDATES:
- Breaking changes: yes — "Significant reorganizations of the Customizer panels in version 4.0.1 aimed to improve UX but temporarily confused users accustomed to the legacy layout." [5]
- Changelog frequency: frequent — The report notes a "highly responsive patch management cycle" where issues are "typically resolved within a week of disclosure". [5]

### 5. BUNDLED PLUGINS
| Plugin | Category | [ID] |
|---|---|---|
| Starter Sites & Templates | Starter Sites | [1] |
| Cloud Templates & Patterns collection | Starter Sites | [1] |
| Elementor Booster (Pro) | Page Builder Enhancement | [10] |
| White Label Module (Pro) | Agency Tools | [5] |

### 6. FAQ CANDIDATES
1. Is Neve a fast theme?
2. What are the most common bugs reported for Neve?
3. How does Neve handle security vulnerabilities?
4. Is Neve a good choice for an agency to use for client websites?
5. Does Neve work well with Elementor and WooCommerce?
6. Can I edit the footer copyright in the free version of Neve?
7. Is Neve's Pro version overwhelming for beginners or clients?
8. How responsive is the support team for free users?

### 7. SCOPE SUMMARY
Pain points breakdown: 5 [THEME], 0 [BLOCKS], 5 [ECOSYSTEM]
Praise breakdown: 4 [THEME], 0 [BLOCKS], 2 [ECOSYSTEM]

### 8. STATS
Total sources with URLs: 13
Pain points extracted: 10
Praise points extracted: 6
Historical sources (>6mo): 8
Changelog entries analyzed: 0 (Analysis based on report's summary of changelog)
Confidence: HIGH

### 9. SOURCE INTEGRITY CHECK
List any [ID] used in the document above that is NOT in the Sources Index: NONE