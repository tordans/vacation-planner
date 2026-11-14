<?php

declare(strict_types=1);

// Usage: php bin/hash-key.php '<key>'
// Prints the sha256 hex digest to put into config.php (edit_key_sha256, view_key_sha256, deploy_key_sha256).
// Prefer reading the key from stdin so it stays out of the shell history:
//   printf '%s' "$KEY" | php bin/hash-key.php -

if ($argc !== 2 || $argv[1] === '') {
    fwrite(STDERR, "Usage: php bin/hash-key.php '<key>'   (or '-' to read the key from stdin)\n");
    exit(1);
}

$key = $argv[1] === '-' ? rtrim((string) stream_get_contents(STDIN), "\r\n") : $argv[1];
if ($key === '') {
    fwrite(STDERR, "Empty key.\n");
    exit(1);
}

echo hash('sha256', $key), "\n";
