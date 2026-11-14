<?php

declare(strict_types=1);

namespace VacationPlanner\Api\Tests\Support;

use PHPUnit\Framework\TestCase;
use VacationPlanner\Api\App;
use VacationPlanner\Api\Config;
use VacationPlanner\Api\Db;
use VacationPlanner\Api\Logger;
use VacationPlanner\Api\Migrator;
use VacationPlanner\Api\Request;
use VacationPlanner\Api\Response;

/**
 * Runs the app in-process against SQLite (in memory) by default.
 * Set TEST_DB_DSN (+ TEST_DB_USER, TEST_DB_PASSWORD) to run the same tests against MariaDB.
 */
abstract class ApiTestCase extends TestCase
{
    protected const EDIT_KEY = 'edit-secret-key';
    protected const VIEW_KEY = 'view-secret-key';
    protected const DEPLOY_KEY = 'deploy-secret-key';

    protected Db $db;
    protected App $app;
    protected \DateTimeImmutable $now;
    protected string $migrationsDir;

    protected function setUp(): void
    {
        $this->migrationsDir = dirname(__DIR__, 2) . '/migrations';
        $this->now = new \DateTimeImmutable('2026-05-10 12:00:00', new \DateTimeZone('UTC'));
        $this->db = self::freshDb();
        $this->app = $this->makeApp();
    }

    protected static function freshDb(): Db
    {
        $dsn = getenv('TEST_DB_DSN');
        if (is_string($dsn) && $dsn !== '') {
            $db = new Db(new \PDO($dsn, getenv('TEST_DB_USER') ?: null, getenv('TEST_DB_PASSWORD') ?: null, [\PDO::ATTR_EMULATE_PREPARES => false]));
            foreach (['plan', 'migrations'] as $table) {
                $db->pdo->exec('DROP TABLE IF EXISTS ' . $table);
            }
        } else {
            $db = new Db(new \PDO('sqlite::memory:'));
        }

        return $db;
    }

    /** @param array<string, mixed> $overrides */
    protected function config(array $overrides = []): Config
    {
        return new Config($overrides + [
            'edit_key_sha256' => hash('sha256', self::EDIT_KEY),
            'view_key_sha256' => hash('sha256', self::VIEW_KEY),
            'deploy_key_sha256' => hash('sha256', self::DEPLOY_KEY),
            'commit' => 'abc1234',
        ]);
    }

    protected function makeApp(?Config $config = null, bool $migrate = true): App
    {
        if ($migrate) {
            (new Migrator($this->db, $this->migrationsDir))->migrate();
        }

        return new App(
            $config ?? $this->config(),
            fn (): Db => $this->db,
            fn (): \DateTimeImmutable => $this->now,
            new Logger('/dev/null'),
            $this->migrationsDir,
        );
    }

    /**
     * Sends a request with the edit key unless $auth is false (or the headers already carry an
     * Authorization header). $json is encoded as the body unless $rawBody is given.
     *
     * @param array<string, string> $headers
     * @param array<string, string> $query
     */
    protected function call(string $method, string $path, mixed $json = null, array $headers = [], array $query = [], ?string $rawBody = null, bool $auth = true): Response
    {
        if ($auth) {
            $headers += ['Authorization' => 'Bearer ' . self::EDIT_KEY];
        }
        $body = $rawBody ?? ($json === null ? '' : json_encode($json, JSON_THROW_ON_ERROR));

        return $this->app->handle(new Request($method, $path, $headers, $query, $body));
    }

    /** @return array<string, mixed> */
    protected function data(Response $response): array
    {
        $data = $response->data();
        self::assertIsArray($data);

        return $data;
    }
}
