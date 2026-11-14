<?php

declare(strict_types=1);

namespace VacationPlanner\Api;

/** Compares sha256(key) of what the client sends with the digests from the config. */
final class Auth
{
    public function __construct(private readonly Config $config)
    {
    }

    /** 'edit' or 'view' for a known bearer key, null for a missing or unknown one. */
    public function role(Request $request): ?string
    {
        $token = $request->bearerToken();
        if ($token === null) {
            return null;
        }
        if (self::matches($token, $this->config->editKeySha256())) {
            return 'edit';
        }
        if (self::matches($token, $this->config->viewKeySha256())) {
            return 'view';
        }

        return null;
    }

    public function deploy(Request $request): bool
    {
        $given = $request->header('x-deploy-key');

        return $given !== null && self::matches($given, $this->config->deployKeySha256());
    }

    private static function matches(string $given, string $expectedHash): bool
    {
        if ($given === '' || $expectedHash === '') {
            return false;
        }

        return hash_equals(strtolower($expectedHash), hash('sha256', $given));
    }
}
