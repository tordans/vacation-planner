<?php

declare(strict_types=1);

/**
 * Example config. On deploy, the GitHub Actions workflow generates the real file from secrets
 * and uploads it OUTSIDE the document root:
 *
 *   urlaub.ingsparks.de/config/config.php   <- here (deployed)
 *   urlaub.ingsparks.de/public/api/index.php <- the web entry, finds ../../config/config.php via ../../api
 *
 * For local development use config.dev.php (dummy keys, SQLite, see api/README.md) or copy this
 * file to api/config.php (git-ignored) and point PLAN_CONFIG at it if you prefer.
 *
 * Hash a key with:  printf '%s' '<key>' | shasum -a 256   (sha256 hex)
 */
return [
    'db' => [
        // MariaDB on all-inkl (host name and credentials come from KAS):
        'dsn' => 'mysql:host=localhost;dbname=CHANGE_ME;charset=utf8mb4',
        'user' => 'CHANGE_ME',
        'password' => 'CHANGE_ME',
    ],

    // sha256 (hex) of the edit key: read and write the plan. The key itself is in the link
    // https://urlaub.ingsparks.de/#key=<editKey>.
    'edit_key_sha256' => '',

    // sha256 (hex) of the view key: read only. Link: https://urlaub.ingsparks.de/#key=<viewKey>.
    'view_key_sha256' => '',

    // sha256 (hex) of the deploy key. Only allows POST /api/migrate (X-Deploy-Key header).
    'deploy_key_sha256' => '',

    // Git commit of the deployed build, shown by GET /api/health.
    'commit' => 'dev',

    // Optional: absolute path of a log file (outside the document root). Empty = PHP error_log.
    // Only short error lines are logged, never request bodies, keys, plans or query strings.
    'log_file' => '',
];
