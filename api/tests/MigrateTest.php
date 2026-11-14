<?php

declare(strict_types=1);

namespace VacationPlanner\Api\Tests;

use VacationPlanner\Api\Migrator;
use VacationPlanner\Api\Tests\Support\ApiTestCase;

/** The API applies the migrations itself before the first request that needs the database. */
final class MigrateTest extends ApiTestCase
{
    /** @var list<string> temporary migration folders, removed in tearDown() */
    private array $dirs = [];

    protected function tearDown(): void
    {
        foreach ($this->dirs as $dir) {
            array_map('unlink', glob($dir . '/*') ?: []);
            rmdir($dir);
        }
        foreach (['t_once', 't_race'] as $table) {
            $this->db->pdo->exec('DROP TABLE IF EXISTS ' . $table);
        }
        parent::tearDown();
    }

    public function testFirstPlanRequestCreatesTheTables(): void
    {
        self::assertFalse($this->tableExists('plans'), 'a fresh database has no tables');

        $r = $this->call('GET', '/api/plan');
        self::assertSame(200, $r->status);
        self::assertSame(['role' => 'edit', 'plan' => null], $r->data());

        self::assertTrue($this->tableExists('plans'));
        self::assertTrue($this->tableExists('invite_attempts'));
        self::assertTrue($this->tableExists('calendar_feeds'));
        self::assertSame(['001_init.sql', '002_calendar_feeds.sql'], array_column($this->db->all('SELECT name FROM migrations'), 'name'));
    }

    public function testLaterRequestsApplyNothing(): void
    {
        // 002 fails when it runs a second time (no IF NOT EXISTS), so a re-run would show as a 500.
        $this->app = $this->makeApp(migrationsDir: $this->migrationsFolder([
            '001_init.sql' => (string) file_get_contents($this->migrationsDir . '/001_init.sql'),
            '002_once.sql' => "CREATE TABLE t_once (id INTEGER NOT NULL PRIMARY KEY);\n",
        ]));

        self::assertSame(200, $this->call('GET', '/api/plan')->status, 'first request applies 001 and 002');
        self::assertSame(200, $this->call('GET', '/api/plan')->status, 'second request applies nothing');
        self::assertSame(200, $this->call('PUT', '/api/plan', ['data' => ['v' => 1]], ['If-None-Match' => '*'])->status);
        self::assertSame(
            ['001_init.sql', '002_once.sql'],
            array_column($this->db->all('SELECT name FROM migrations ORDER BY name'), 'name'),
        );
    }

    public function testMigrationRecordedByAConcurrentRequestDoesNotFail(): void
    {
        // Simulates another request that records 001 between this request's read of the applied
        // names and its own INSERT: the primary key refuses the second row, which is not an error.
        $dir = $this->migrationsFolder([
            '001_race.sql' => "CREATE TABLE IF NOT EXISTS t_race (id INTEGER NOT NULL PRIMARY KEY);\n"
                . "INSERT INTO migrations (name, applied_at) VALUES ('001_race.sql', '2026-01-01 00:00:00');\n",
        ]);

        self::assertSame([], (new Migrator($this->db, $dir))->migrate());
        self::assertSame(1, (int) $this->db->one('SELECT COUNT(*) AS n FROM migrations')['n']);
        self::assertTrue($this->tableExists('t_race'));
    }

    public function testAppliesOnlyPendingMigrationsInOrder(): void
    {
        $dir = sys_get_temp_dir() . '/migrations-' . bin2hex(random_bytes(4));
        mkdir($dir);
        file_put_contents($dir . '/001_a.sql', "-- first\nCREATE TABLE IF NOT EXISTS t_a (id INTEGER NOT NULL PRIMARY KEY);\n");
        file_put_contents($dir . '/002_b.sql', "CREATE TABLE IF NOT EXISTS t_b (id INTEGER NOT NULL PRIMARY KEY);\n-- comment; with semicolon\nCREATE TABLE IF NOT EXISTS t_c (id INTEGER NOT NULL PRIMARY KEY);\n");

        try {
            $migrator = new Migrator($this->db, $dir);
            self::assertSame(['001_a.sql', '002_b.sql'], $migrator->migrate());
            file_put_contents($dir . '/003_d.sql', "CREATE TABLE IF NOT EXISTS t_d (id INTEGER NOT NULL PRIMARY KEY);\n");
            self::assertSame(['003_d.sql'], $migrator->migrate());
            self::assertSame([], $migrator->migrate());
            foreach (['t_a', 't_b', 't_c', 't_d'] as $table) {
                $this->db->run("SELECT 1 FROM $table");
            }
        } finally {
            foreach (['t_a', 't_b', 't_c', 't_d'] as $table) {
                $this->db->pdo->exec("DROP TABLE IF EXISTS $table");
            }
            array_map('unlink', glob($dir . '/*') ?: []);
            rmdir($dir);
        }
    }

    /** @param array<string, string> $files file name => SQL; returns a temporary migrations folder */
    private function migrationsFolder(array $files): string
    {
        $dir = sys_get_temp_dir() . '/migrations-' . bin2hex(random_bytes(4));
        mkdir($dir);
        $this->dirs[] = $dir;
        foreach ($files as $name => $sql) {
            file_put_contents($dir . '/' . $name, $sql);
        }

        return $dir;
    }

    private function tableExists(string $table): bool
    {
        try {
            $this->db->run("SELECT 1 FROM $table");

            return true;
        } catch (\PDOException) {
            return false;
        }
    }
}
