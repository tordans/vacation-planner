<?php

declare(strict_types=1);

namespace VacationPlanner\Api;

/**
 * Finds the plan of a key: looks up sha256(key) in the edit and view columns. Which column
 * matched gives the role. Unknown keys give null.
 */
final class Auth
{
    public function __construct(private readonly Db $db)
    {
    }

    public function resolve(string $key): ?Access
    {
        if ($key === '') {
            return null;
        }
        $hash = Keys::hash($key);
        $row = $this->db->one(
            'SELECT id, edit_key_sha256, view_key_sha256 FROM plans WHERE edit_key_sha256 = ? OR view_key_sha256 = ?',
            [$hash, $hash],
        );
        if ($row === null) {
            return null;
        }
        if (hash_equals((string) $row['edit_key_sha256'], $hash)) {
            return new Access((string) $row['id'], 'edit');
        }
        if (hash_equals((string) $row['view_key_sha256'], $hash)) {
            return new Access((string) $row['id'], 'view');
        }

        return null;
    }
}
