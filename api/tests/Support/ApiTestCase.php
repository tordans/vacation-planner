<?php

declare(strict_types=1);

namespace VacationPlanner\Api\Tests\Support;

use PHPUnit\Framework\TestCase;
use VacationPlanner\Api\App;
use VacationPlanner\Api\Config;
use VacationPlanner\Api\Db;
use VacationPlanner\Api\Logger;
use VacationPlanner\Api\Request;
use VacationPlanner\Api\Response;

/**
 * Runs the app in-process against SQLite (in memory) by default.
 * Set TEST_DB_DSN (+ TEST_DB_USER, TEST_DB_PASSWORD) to run the same tests against MariaDB.
 */
abstract class ApiTestCase extends TestCase
{
    protected const INVITE = 'test-invite-word';
    protected const IP = '203.0.113.7';

    protected Db $db;
    protected App $app;
    protected \DateTimeImmutable $now;
    protected string $migrationsDir;

    /** @var array{editKey: string, viewKey: string}|null the plan used by call() unless auth is false */
    private ?array $defaultPlan = null;

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
            foreach (['plans', 'invite_attempts', 'migrations'] as $table) {
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
            'invite_sha256' => hash('sha256', self::INVITE),
            'ip_salt_secret' => 'test-ip-salt-secret',
            'commit' => 'abc1234',
        ]);
    }

    /** The app migrates the database itself before the first request that needs it. */
    protected function makeApp(?Config $config = null, ?string $migrationsDir = null): App
    {
        return new App(
            $config ?? $this->config(),
            fn (): Db => $this->db,
            fn (): \DateTimeImmutable => $this->now,
            new Logger('/dev/null'),
            $migrationsDir ?? $this->migrationsDir,
        );
    }

    /**
     * Sends a request with the edit key of the default plan unless $auth is false (or the headers
     * already carry an Authorization header). The default plan is created through POST /api/plans
     * on first use. $json is encoded as the body unless $rawBody is given.
     *
     * @param array<string, string> $headers
     * @param array<string, string> $query
     */
    protected function call(string $method, string $path, mixed $json = null, array $headers = [], array $query = [], ?string $rawBody = null, bool $auth = true, ?string $ip = null): Response
    {
        if ($auth && !isset($headers['Authorization'])) {
            $headers['Authorization'] = 'Bearer ' . $this->editKey();
        }
        $body = $rawBody ?? ($json === null ? '' : json_encode($json, JSON_THROW_ON_ERROR));

        return $this->app->handle(new Request($method, $path, $headers, $query, $body, ip: $ip ?? self::IP));
    }

    /** Creates a plan with the right invite word and returns its keys. */
    protected function newPlan(?string $ip = null): array
    {
        $r = $this->call('POST', '/api/plans', ['invite' => self::INVITE], auth: false, ip: $ip);
        self::assertSame(201, $r->status);
        $keys = $this->data($r);
        self::assertSame(['editKey', 'viewKey'], array_keys($keys));

        return $keys;
    }

    protected function editKey(): string
    {
        return ($this->defaultPlan ??= $this->newPlan())['editKey'];
    }

    protected function viewKey(): string
    {
        return ($this->defaultPlan ??= $this->newPlan())['viewKey'];
    }

    /** @return array<string, string> Authorization header for a key */
    protected static function bearer(string $key): array
    {
        return ['Authorization' => 'Bearer ' . $key];
    }

    /** @return array<string, mixed> */
    protected function data(Response $response): array
    {
        $data = $response->data();
        self::assertIsArray($data);

        return $data;
    }
}
