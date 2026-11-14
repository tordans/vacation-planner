<?php

declare(strict_types=1);

/**
 * Local development only, used by `bun run dev-api` (PLAN_CONFIG=/app/config.dev.php in Docker).
 * The keys below are dummies. Never deploy this file: the deploy workflow writes
 * config/config.php from GitHub secrets. The migrations run on the first /api/plan request.
 *
 *   edit key:   dev-edit-key    ->  http://localhost:5173/#key=dev-edit-key
 *   view key:   dev-view-key    ->  http://localhost:5173/#key=dev-view-key
 */
return [
    // SQLite file inside the api folder (api/dev/ is git-ignored), path as seen inside the container.
    'db' => [
        'dsn' => 'sqlite:/app/dev/plan.sqlite',
        'user' => '',
        'password' => '',
    ],
    'edit_key_sha256' => hash('sha256', 'dev-edit-key'),
    'view_key_sha256' => hash('sha256', 'dev-view-key'),
    'commit' => 'dev',
    'log_file' => '',
];
