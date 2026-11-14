<?php

declare(strict_types=1);

namespace VacationPlanner\Api;

/** Typed access to the config array (see config.example.php). */
final class Config
{
    /** @param array<string, mixed> $values */
    public function __construct(private readonly array $values)
    {
    }

    /** Load a config file that returns an array. */
    public static function fromFile(string $path): self
    {
        if (!is_file($path)) {
            throw new \RuntimeException('Config file not found.');
        }
        $values = (static function () use ($path) {
            /** @psalm-suppress UnresolvableInclude */
            return require $path;
        })();
        if (!is_array($values)) {
            throw new \RuntimeException('Config file must return an array.');
        }

        return new self($values);
    }

    /**
     * Where the config lives: $PLAN_CONFIG, then api/config.php (local development),
     * then ../config/config.php next to the api folder (deployed layout, outside the web root).
     */
    public static function locate(string $apiRoot): string
    {
        $env = getenv('PLAN_CONFIG');
        if (is_string($env) && $env !== '') {
            return $env;
        }
        foreach ([$apiRoot . '/config.php', dirname($apiRoot) . '/config/config.php'] as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }

        return dirname($apiRoot) . '/config/config.php';
    }

    public function dbDsn(): string
    {
        return $this->string(['db', 'dsn']);
    }

    public function dbUser(): ?string
    {
        $v = $this->string(['db', 'user']);

        return $v === '' ? null : $v;
    }

    public function dbPassword(): ?string
    {
        $v = $this->string(['db', 'password']);

        return $v === '' ? null : $v;
    }

    /** sha256 hex of the edit key (parents: read and write). */
    public function editKeySha256(): string
    {
        return $this->string(['edit_key_sha256']);
    }

    /** sha256 hex of the view key (read only). */
    public function viewKeySha256(): string
    {
        return $this->string(['view_key_sha256']);
    }

    public function commit(): string
    {
        $v = $this->string(['commit']);

        return $v === '' ? 'unknown' : $v;
    }

    public function logFile(): ?string
    {
        $v = $this->string(['log_file']);

        return $v === '' ? null : $v;
    }

    /** @param list<string> $path */
    private function string(array $path): string
    {
        $node = $this->values;
        foreach ($path as $key) {
            if (!is_array($node) || !array_key_exists($key, $node)) {
                return '';
            }
            $node = $node[$key];
        }

        return is_string($node) ? $node : '';
    }
}
