<?php

declare(strict_types=1);

namespace VacationPlanner\Api;

/** Plan keys: 32 random bytes as base64url (43 characters). Only their SHA-256 hex is stored. */
final class Keys
{
    public static function generate(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    }

    public static function hash(string $key): string
    {
        return hash('sha256', $key);
    }
}
