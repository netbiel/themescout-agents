/**
 * Verify Dashboard — JavaScript
 *
 * Handles AJAX interactions for the Theme Verification Dashboard:
 * - TSV import modal
 * - Issue resolve/confirm/skip/dismiss
 * - Inline ACF field editing
 * - Bulk resolve actions
 * - Client-side filtering
 *
 * @package WPAgent\SmartSearch
 */
(function ($) {
    'use strict';

    // ── Globals ────────────────────────────────────────────────────────

    var ajaxUrl = wpVerifyDashboard.ajaxUrl;
    var nonce = wpVerifyDashboard.nonce;
    var fieldMap = wpVerifyDashboard.fieldActionMap;

    // ── Import Modal ──────────────────────────────────────────────────

    $(document).on('click', '#vd-open-import', function () {
        $('#vd-import-modal').show();
        $('#vd-import-textarea').val('').focus();
        $('#vd-import-result').empty();
    });

    $(document).on('click', '#vd-import-cancel, .vd-modal-backdrop', function () {
        $('#vd-import-modal').hide();
    });

    $(document).on('click', '#vd-import-submit', function () {
        var tsvData = $('#vd-import-textarea').val().trim();
        if (!tsvData) {
            showImportResult('error', 'Please paste TSV data first.');
            return;
        }

        var $btn = $(this);
        $btn.prop('disabled', true);
        $('#vd-import-spinner').addClass('is-active');

        $.ajax({
            url: ajaxUrl,
            method: 'POST',
            data: {
                action: 'wpagent_verify_import',
                nonce: nonce,
                tsv_data: tsvData
            },
            success: function (response) {
                if (response.success) {
                    var d = response.data;
                    var msg = 'Imported ' + d.issues_imported + ' issues across ' + d.themes_processed + ' themes.';
                    if (d.errors && d.errors.length) {
                        msg += '\n\nWarnings:\n• ' + d.errors.join('\n• ');
                    }
                    showImportResult('success', msg);
                    // Reload page after brief delay to show updated list.
                    setTimeout(function () {
                        location.reload();
                    }, 1500);
                } else {
                    var errMsg = (response.data && response.data.message) ? response.data.message : 'Import failed.';
                    if (response.data && response.data.errors && response.data.errors.length) {
                        errMsg += '\n• ' + response.data.errors.join('\n• ');
                    }
                    showImportResult('error', errMsg);
                }
            },
            error: function () {
                showImportResult('error', 'Network error. Please try again.');
            },
            complete: function () {
                $btn.prop('disabled', false);
                $('#vd-import-spinner').removeClass('is-active');
            }
        });
    });

    function showImportResult(type, message) {
        var cls = (type === 'success') ? 'notice-success' : 'notice-error';
        $('#vd-import-result').html(
            '<div class="notice ' + cls + ' inline"><p>' + escHtml(message).replace(/\n/g, '<br>') + '</p></div>'
        );
    }

    // ── Issue Actions ─────────────────────────────────────────────────

    // Confirm.
    $(document).on('click', '.vd-btn-confirm', function () {
        resolveIssue($(this).closest('.vd-issue-card'), 'confirmed');
    });

    // Skip.
    $(document).on('click', '.vd-btn-skip', function () {
        resolveIssue($(this).closest('.vd-issue-card'), 'skipped');
    });

    // Dismiss.
    $(document).on('click', '.vd-btn-dismiss', function () {
        resolveIssue($(this).closest('.vd-issue-card'), 'dismissed');
    });

    // Pipeline fix.
    $(document).on('click', '.vd-btn-pipeline-fix', function () {
        resolveIssue($(this).closest('.vd-issue-card'), 'pipeline_fix');
    });

    function resolveIssue($card, resolution) {
        var issueId = $card.data('issue-id');
        var postId = $card.closest('.vd-issues-list').data('post-id') || $card.find('.vd-issue-actions').data('post-id');
        var notes = $card.find('.vd-notes-input').val() || '';

        $card.css('opacity', '0.4');

        $.ajax({
            url: ajaxUrl,
            method: 'POST',
            data: {
                action: 'wpagent_verify_resolve',
                nonce: nonce,
                post_id: postId,
                issue_id: issueId,
                resolution: resolution,
                notes: notes
            },
            success: function (response) {
                if (response.success) {
                    markCardResolved($card, resolution);
                    updateSummaryBar(response.data.summary);
                } else {
                    $card.css('opacity', '1');
                    alert('Error: ' + (response.data.message || 'Unknown error'));
                }
            },
            error: function () {
                $card.css('opacity', '1');
                alert('Network error.');
            }
        });
    }

    function markCardResolved($card, resolution) {
        $card.addClass('vd-resolved vd-just-resolved');
        $card.attr('data-status', (resolution === 'dismissed') ? 'dismissed' : 'resolved');
        $card.css('opacity', '');

        // Remove action buttons.
        $card.find('.vd-issue-actions').remove();

        // Add resolved badge.
        var labels = {
            'confirmed': '✅ Confirmed',
            'fixed': '🔧 Fixed',
            'skipped': '⏭️ Skipped',
            'dismissed': '❌ Dismissed',
            'pipeline_fix': '🔧 Pipeline fix'
        };
        var label = labels[resolution] || '✅ Resolved';
        $card.find('.vd-issue-header').append('<span class="vd-resolved-badge">' + escHtml(label) + '</span>');
    }

    // ── Inline Edit ───────────────────────────────────────────────────

    $(document).on('click', '.vd-btn-fix', function () {
        var $card = $(this).closest('.vd-issue-card');
        $card.find('.vd-inline-editor').slideDown(200);
    });

    $(document).on('click', '.vd-cancel-edit', function () {
        $(this).closest('.vd-inline-editor').slideUp(200);
    });

    $(document).on('click', '.vd-save-edit', function () {
        var $editor = $(this).closest('.vd-inline-editor');
        var $card = $editor.closest('.vd-issue-card');
        var postId = $card.closest('.vd-issues-list').data('post-id') || $card.find('.vd-issue-actions').data('post-id');
        var issueId = $card.data('issue-id');
        var fieldKey = $card.find('.vd-btn-fix').data('field-key');
        var newValue = $editor.find('.vd-edit-input').val();

        var $btn = $(this);
        $btn.prop('disabled', true).text('Saving…');

        $.ajax({
            url: ajaxUrl,
            method: 'POST',
            data: {
                action: 'wpagent_verify_update_field',
                nonce: nonce,
                post_id: postId,
                issue_id: issueId,
                field_key: fieldKey,
                new_value: newValue
            },
            success: function (response) {
                if (response.success) {
                    markCardResolved($card, 'fixed');
                } else {
                    alert('Error: ' + (response.data.message || 'Unknown error'));
                }
            },
            error: function () {
                alert('Network error.');
            },
            complete: function () {
                $btn.prop('disabled', false).text('💾 Save');
            }
        });
    });

    // ── Bulk Actions ──────────────────────────────────────────────────

    $(document).on('click', '.vd-bulk-btn', function () {
        var bulkAction = $(this).data('action');
        var postId = $(this).closest('.vd-bulk-actions').data('post-id');

        if (bulkAction === 'mark_all_resolved') {
            if (!confirm('Are you sure you want to mark ALL issues as resolved?')) {
                return;
            }
        }

        var $btn = $(this);
        $btn.prop('disabled', true);

        $.ajax({
            url: ajaxUrl,
            method: 'POST',
            data: {
                action: 'wpagent_verify_bulk_resolve',
                nonce: nonce,
                post_id: postId,
                bulk_action: bulkAction
            },
            success: function (response) {
                if (response.success) {
                    alert('Resolved ' + response.data.resolved_count + ' issues.');
                    location.reload();
                } else {
                    alert('Error: ' + (response.data.message || 'Unknown error'));
                }
            },
            error: function () {
                alert('Network error.');
            },
            complete: function () {
                $btn.prop('disabled', false);
            }
        });
    });

    // ── Repeater Save ─────────────────────────────────────────────────

    $(document).on('click', '.vd-save-repeater', function () {
        var $editor = $(this).closest('.vd-inline-editor');
        var $card = $editor.closest('.vd-issue-card');
        var postId = $card.closest('.vd-issues-list').data('post-id') || $card.find('.vd-issue-actions').data('post-id');
        var issueId = $card.data('issue-id');
        var fieldKey = $card.find('.vd-btn-fix').data('field-key');

        // Collect subfield values into a JSON object.
        var rowData = {};
        $editor.find('.vd-repeater-input').each(function () {
            var sf = $(this).data('subfield');
            rowData[sf] = $(this).val();
        });

        var $btn = $(this);
        $btn.prop('disabled', true).text('Saving…');

        $.ajax({
            url: ajaxUrl,
            method: 'POST',
            data: {
                action: 'wpagent_verify_update_field',
                nonce: nonce,
                post_id: postId,
                issue_id: issueId,
                field_key: fieldKey,
                new_value: JSON.stringify(rowData)
            },
            success: function (response) {
                if (response.success) {
                    markCardResolved($card, 'fixed');
                } else {
                    alert('Error: ' + (response.data.message || 'Unknown error'));
                }
            },
            error: function () {
                alert('Network error.');
            },
            complete: function () {
                $btn.prop('disabled', false).text('💾 Add Row');
            }
        });
    });

    // ── Override Removal ──────────────────────────────────────────────

    $(document).on('click', '.vd-remove-override', function () {
        var $btn = $(this);
        var fieldKey = $btn.data('field');
        var postId = $btn.closest('.vd-override-panel').data('post-id');

        if (!confirm('Remove override for "' + fieldKey + '"? The next import will overwrite this field.')) {
            return;
        }

        $btn.prop('disabled', true);
        $.ajax({
            url: ajaxUrl,
            method: 'POST',
            data: {
                action: 'wpagent_verify_remove_override',
                nonce: nonce,
                post_id: postId,
                field_key: fieldKey
            },
            success: function (response) {
                if (response.success) {
                    $btn.closest('.vd-override-item').fadeOut(300, function () { $(this).remove(); });
                } else {
                    alert('Error: ' + (response.data.message || 'Unknown error'));
                }
            },
            error: function () {
                alert('Network error.');
            },
            complete: function () {
                $btn.prop('disabled', false);
            }
        });
    });

    $(document).on('click', '#vd-remove-all-overrides', function () {
        var $btn = $(this);
        var postId = $btn.closest('.vd-override-panel').data('post-id');

        if (!confirm('Remove ALL overrides? All fields will be overwritable by the next pipeline import.')) {
            return;
        }

        $btn.prop('disabled', true);
        $.ajax({
            url: ajaxUrl,
            method: 'POST',
            data: {
                action: 'wpagent_verify_remove_all_overrides',
                nonce: nonce,
                post_id: postId
            },
            success: function (response) {
                if (response.success) {
                    location.reload();
                } else {
                    alert('Error: ' + (response.data.message || 'Unknown error'));
                }
            },
            error: function () {
                alert('Network error.');
            },
            complete: function () {
                $btn.prop('disabled', false);
            }
        });
    });

    // ── Client-Side Filters (Themes List) ─────────────────────────────

    $(document).on('change', '#vd-filter-severity, #vd-filter-status, #vd-filter-overrides', function () {
        filterThemesList();
    });

    function filterThemesList() {
        var severity = $('#vd-filter-severity').val();
        var status = $('#vd-filter-status').val();
        var overrides = $('#vd-filter-overrides').val();

        $('.vd-themes-table tbody tr').each(function () {
            var $row = $(this);
            var show = true;
            var rowStatus = $row.data('status');
            var rowOverrides = parseInt($row.data('overrides'), 10) || 0;

            if (status && rowStatus !== status) {
                show = false;
            }

            if (severity) {
                var count = 0;
                if (severity === 'error') count = parseInt($row.data('severity-errors'), 10);
                else if (severity === 'warning') count = parseInt($row.data('severity-warnings'), 10);
                else if (severity === 'info') count = parseInt($row.data('severity-info'), 10);
                if (count === 0) show = false;
            }

            if (overrides === 'has_overrides' && rowOverrides === 0) show = false;
            if (overrides === 'no_overrides' && rowOverrides > 0) show = false;

            $row.toggle(show);
        });
    }

    // ── Client-Side Filters (Issue Cards) ─────────────────────────────

    $(document).on('change', '#vd-issue-filter-severity, #vd-issue-filter-layer, #vd-issue-filter-status', function () {
        filterIssueCards();
    });

    function filterIssueCards() {
        var severity = $('#vd-issue-filter-severity').val();
        var layer = $('#vd-issue-filter-layer').val();
        var status = $('#vd-issue-filter-status').val();

        $('.vd-issue-card').each(function () {
            var $card = $(this);
            var show = true;

            if (severity && $card.data('severity') !== severity) show = false;
            if (layer && $card.data('layer') !== layer) show = false;
            if (status && $card.data('status') !== status) show = false;

            $card.toggle(show);
        });
    }

    // ── Summary Bar Update ────────────────────────────────────────────

    function updateSummaryBar(summary) {
        if (!summary) return;

        var $bar = $('.vd-summary-bar');
        if (!$bar.length) return;

        var total = summary.total || 0;
        var resolved = summary.resolved || 0;
        var pct = total > 0 ? Math.round((resolved / total) * 100) : 0;

        $bar.find('.vd-summary-progress').text(resolved + '/' + total + ' resolved');
        $bar.find('.vd-progress-fill').css('width', pct + '%');
    }

    // ── Helpers ───────────────────────────────────────────────────────

    function escHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

})(jQuery);
