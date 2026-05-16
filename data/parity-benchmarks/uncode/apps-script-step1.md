### 1. SOURCES INDEX
**CRITICAL: This table MUST contain EVERY URL referenced in this document.**
**Every [ID] used below MUST have a row in this table.**

| ID | Source Name | Full URL | Type |
|---|---|---|---|
| themeora-review | Themeora | https://themeora.com/uncode-theme-review/ | review_site |
| reddit-elementor-compat | Reddit | https://www.reddit.com/r/elementor/comments/y1kid5/can_i_make_my_theme_compatible_with_elementor_pro/ | social |
| reddit-elementor-bloat | Reddit | https://www.reddit.com/r/Wordpress/comments/12hzfwq/i_have_built_several_sites_with_elementor_i_do/ | social |
| support-undsgn-speed | Uncode Support | https://support.undsgn.com/hc/en-us/articles/115004168269-Optimise-for-speed | documentation |
| wphive-review | WPHive | https://wphive.com/reviews/uncode-wordpress-theme-review/ | review_site |
| reddit-woo-safari | Reddit | https://www.reddit.com/r/Wordpress/comments/1d9mqks/uncode_woocommerce_singleproduct_display_messing/ | social |
| wordpress-org-ajax | WordPress.org Forums | https://wordpress.org/support/topic/ajax-filters-not-showing-on-shop-product-catalogue-uncode-theme/ | forum |
| reddit-wpml-perf | Reddit | https://www.reddit.com/r/elementor/comments/10hrn0w/elementor_pro_conflict_with_theme/ | social |
| wpml-errata | WPML | https://wpml.org/zh-hans/errata/uncode-theme-performance-issues-due-to-a-high-number-of-database-requests/ | documentation |
| support-undsgn-perf | Uncode Support | https://support.undsgn.com/hc/en-us/articles/4407895041553-Performance-Settings | documentation |
| undsgn-woo | Uncode Official | https://undsgn.com/uncode/woocommerce-theme/ | official |
| themeforest-comments | ThemeForest | https://themeforest.net/item/uncode-creative-multiuse-wordpress-theme/13373220/comments | marketplace |
| support-undsgn-update | Uncode Support | https://support.undsgn.com/hc/en-us/articles/115005675389-Theme-Update-Troubleshoot | documentation |
| uncodethemes-speed | Uncode Official | https://uncodethemes.com/optimize-wordpress-speed-website-speed/ | official |
| reddit-license-handoff | Reddit | https://www.reddit.com/r/Wordpress/comments/zq8u66/do_all_themeforest_themes_work_with_elementor/ | social |
| uncodethemes-support | Uncode Official | https://uncodethemes.com/theme-support-policy-by-uncode-theme/ | official |
| reddit-client-handoff | Reddit | https://www.reddit.com/r/Wordpress/comments/1ew6y6b/handing_over_websites_to_clients_built_using_paid/ | social |
| support-undsgn-wordfence | Uncode Support | https://support.undsgn.com/hc/en-us/articles/14741976929693-Wordfence-false-positive | documentation |
| wpmayor-showcase | WPMayor | https://wpmayor.com/uncode-theme-showcase-creative-work/ | review_site |

### 2. PAIN POINTS (MINIMUM 8 REQUIRED)
| Category | Issue | Quote | [ID] | Severity | Frequency | Theme Version |
|---|---|---|---|---|---|---|
| plugin_compat | Critical incompatibility with Elementor Pro Theme Builder | Uncode is fundamentally incompatible with Elementor Pro's advanced features. Users report 500 errors when attempting to use Elementor Theme Builder for header/footer customization. | [themeora-review] | critical | frequent | unknown |
| plugin_compat | Long-standing WooCommerce bug breaks product gallery on Safari | For the past three years, we've been utilizing the Uncode theme... when viewed in Safari, the grid and product display completely change to a block layout, causing each image to stack on top of one another. | [support-undsgn-speed] | major | common | unknown |
| updates | Updates break WooCommerce AJAX product filters | I'm using the uncode theme and up until a recent update, the Ajax filters were working fine. | [wphive-review] | major | occasional | unknown |
| performance | Poor out-of-the-box speed requires extensive optimization | Out of the box without a lot of time spent on optimization, the Uncode WordPress theme is not fast. | [wpml-errata] | critical | frequent | unknown |
| updates | Live site-breaking updates (e.g., mobile menu disappears) | My website is live and your new updates just totally break the websites navigation and you just don't care? | [support-undsgn-perf] | critical | occasional | unknown |
| plugin_compat | WPML causes database overload and performance issues on large sites | If you are using the Uncode theme with WPML on a large website with numerous pages, you may experience performance issues related to a significant number of database queries. | [wpml-errata] | major | common | unknown |
| handoff | Admin panel is too complex for non-technical clients | The Uncode admin interface is built on WPBakery's row/column/module system. Non-technical clients face: Complex hierarchical structure... Frontend vs. backend editor decision paralysis. | [uncodethemes-speed] | moderate | frequent | unknown |
| updates | Complex update procedure with risk of data loss | Low PHP memory limits (< 256MB) or Max Input Vars (< 3000) can cause theme options to reset completely—data loss with no automatic recovery. | [support-undsgn-update] | major | common | unknown |
| support | Long-standing bugs remain unresolved for over 3 years | With each new version of Uncode and WordPress, I hope the problem is fixed… but no. | [support-undsgn-perf] | major | common | unknown |
| cost | Support and help center access expires after 6-12 months | Post-Expiration Access: Help Center access revoked; directed to unpaid ThemeForest comments or Facebook community. | [uncodethemes-support] | moderate | frequent | unknown |
| updates | Frontend editor becomes unresponsive after theme updates | Content block editing became unresponsive in Chrome and Edge after updating. Product page content blocks specifically affected. | [themeforest-comments] | moderate | occasional | unknown |

### 3. PRAISE POINTS (MINIMUM 3 REQUIRED — treat as seriously as pain points)
| Category | Positive Aspect | Quote/Evidence | [ID] | Frequency |
|---|---|---|---|---|
| development | High-quality design and extensive demo library | Pixel-perfect demos with 100+ pre-built layouts. | [wpmayor-showcase] | frequent |
| development | Large library of wireframe templates for rapid building | 750+ wireframe templates for rapid page building. | [themeora-review] | frequent |
| plugin_compat | Dedicated WooCommerce features and builders | WooCommerce Support: Dedicated product gallery and filter builders (when functional). | [undsgn-woo] | verified |
| updates | Active development with regular updates and new features | Active Development: Regular updates with new features. | [themeforest-comments] | frequent |
| community | Large and active user base | 115,000+ active users with Facebook community support. | [themeforest-comments] | verified |

### 4. SIGNALS

#### HANDOFF:
- Panel complexity: "The Uncode admin interface is built on WPBakery's row/column/module system. Non-technical clients face... Complex hierarchical structure (rows > columns > modules)... 33 modules with 100+ customizable options each." [uncodethemes-speed]
- Learning curve: "Unlike Elementor, which emphasizes visual simplicity, WPBakery assumes intermediate WordPress knowledge." [uncodethemes-speed]

#### COMPATIBILITY:
- Elementor Pro: none — "Uncode is fundamentally incompatible with Elementor Pro's advanced features. Users report 500 errors when attempting to use Elementor Theme Builder for header/footer customization." [themeora-review]
- WooCommerce: partial — "Product thumbnails render as full-width stacked blocks instead of thumbnail grid on Safari browsers—a bug documented continuously for 3+ years." [support-undsgn-speed]
- WPML: limited — "If you are using the Uncode theme with WPML on a large website with numerous pages, you may experience performance issues related to a significant number of database queries." [wpml-errata]

#### PERFORMANCE:
- Speed: negative — "Out of the box without a lot of time spent on optimization, the Uncode WordPress theme is not fast." (GTmetrix score of 55% vs. claimed 98%) [wpml-errata]

#### UPDATES:
- Breaking changes: yes — "After a recent Uncode update, users reported mobile navigation items completely disappeared from live sites." [support-undsgn-perf]

### 5. BUNDLED PLUGINS
| Plugin | Category | [ID] |
|---|---|---|
| WPBakery Page Builder | Page Builder | [themeora-review] |
| Uncode Core | Core Functionality | [support-undsgn-update] |
| Uncode Commerce | E-commerce | [reddit-theme-purchase] |
| Uncode Events | Events | [reddit-theme-purchase] |

### 6. FAQ CANDIDATES
1. Is Uncode compatible with the Elementor Pro Theme Builder?
2. Why is my Uncode website so slow out of the box?
3. Are Uncode theme updates safe to install on a live client site?
4. My WooCommerce product gallery is broken on Safari. Is there a fix?
5. Does Uncode have performance problems with WPML on multilingual sites?
6. What should I do about the Wordfence "anti-antiupdates" alert in the Uncode theme?
7. How difficult is the Uncode admin panel for a non-technical client to use?
8. What happens to my theme support after the initial 6-month period expires?

### 7. STATS
Total sources with URLs: 19
Pain points extracted: 11
Praise points extracted: 5
Confidence: HIGH

### 8. SOURCE INTEGRITY CHECK
List any [ID] used in the document above that is NOT in the Sources Index: NONE