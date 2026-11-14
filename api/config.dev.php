<?php

declare(strict_types=1);

/**
 * Local development only, used by `bun run dev-api` (PLAN_CONFIG=/app/config.dev.php in Docker).
 * The invite word and the salt secret below are dummies. Never deploy this file: the deploy
 * workflow writes config/config.php from GitHub secrets. The migrations run on the first request
 * that needs the database.
 *
 *   invite word:  dev-invite   ->  open http://localhost:5173/, "Neuen Plan anlegen", enter the word
 *
 * Plans and their keys are created in the app; they live in api/dev/plan.sqlite (delete the folder
 * to start over).
 */
return [
    // SQLite file inside the api folder (api/dev/ is git-ignored), path as seen inside the container.
    'db' => [
        'dsn' => 'sqlite:/app/dev/plan.sqlite',
        'user' => '',
        'password' => '',
    ],
    'invite_sha256' => hash('sha256', 'dev-invite'),
    'ip_salt_secret' => 'dev-ip-salt-secret',
    'commit' => 'dev',
    'log_file' => '',
];
