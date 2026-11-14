<?php

declare(strict_types=1);

/**
 * Example config. On deploy, the GitHub Actions workflow generates the real file from secrets
 * and uploads it OUTSIDE the document root:
 *
 *   vacation.ingsparks.de/config/config.php   <- here (deployed)
 *   vacation.ingsparks.de/public/api/index.php <- the web entry, finds ../../config/config.php via ../../api
 *
 * For local development use config.dev.php (dev invite word, SQLite, see api/README.md) or copy this
 * file to api/config.php (git-ignored) and point PLAN_CONFIG at it if you prefer.
 *
 * Hash the invite word with:  printf '%s' '<word>' | shasum -a 256   (sha256 hex)
 */
return [
    'db' => [
        // MariaDB on all-inkl (host name and credentials come from KAS):
        'dsn' => 'mysql:host=localhost;dbname=CHANGE_ME;charset=utf8mb4',
        'user' => 'CHANGE_ME',
        'password' => 'CHANGE_ME',
    ],

    // sha256 (hex) of the invite word. Whoever knows the word can create a plan (POST /api/plans);
    // each plan then gets its own edit and view key (only their digests are stored in the database).
    // Empty = nobody can create a plan.
    'invite_sha256' => '',

    // Secret for the daily salt of the IP hashes that count failed invite attempts (no plain IP is
    // stored). Any long random string, stable between deploys. The deploy workflow derives it from
    // DB_PASSWORD, so there is no extra secret. Must not be empty.
    'ip_salt_secret' => 'CHANGE_ME',

    // Git commit of the deployed build, shown by GET /api/health.
    'commit' => 'dev',

    // Optional: absolute path of a log file (outside the document root). Empty = PHP error_log.
    // Only short error lines are logged, never request bodies, keys, plans or query strings.
    'log_file' => '',
];
