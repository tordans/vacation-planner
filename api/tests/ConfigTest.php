<?php

declare(strict_types=1);

namespace VacationPlanner\Api\Tests;

use PHPUnit\Framework\TestCase;
use VacationPlanner\Api\Config;

final class ConfigTest extends TestCase
{
    public function testExampleConfigLoadsAndDeclaresAllKeys(): void
    {
        $config = Config::fromFile(dirname(__DIR__) . '/config.example.php');
        self::assertStringStartsWith('mysql:', $config->dbDsn());
        self::assertSame('dev', $config->commit());
        self::assertNull($config->logFile());
        self::assertSame('', $config->editKeySha256());
        self::assertSame('', $config->viewKeySha256());
        self::assertSame('', $config->deployKeySha256());
    }

    public function testMissingFileThrows(): void
    {
        $this->expectException(\RuntimeException::class);
        Config::fromFile('/nonexistent/config.php');
    }

    public function testDeployedLayoutIsFound(): void
    {
        $root = sys_get_temp_dir() . '/plan-' . bin2hex(random_bytes(4));
        mkdir($root . '/api', 0777, true);
        mkdir($root . '/config', 0777, true);
        file_put_contents($root . '/config/config.php', '<?php return [];');
        try {
            self::assertSame($root . '/config/config.php', Config::locate($root . '/api'));
            file_put_contents($root . '/api/config.php', '<?php return [];');
            self::assertSame($root . '/api/config.php', Config::locate($root . '/api'), 'local dev file wins');
        } finally {
            @unlink($root . '/api/config.php');
            unlink($root . '/config/config.php');
            rmdir($root . '/config');
            rmdir($root . '/api');
            rmdir($root);
        }
    }

    public function testEnvironmentVariableWins(): void
    {
        putenv('PLAN_CONFIG=/srv/plan/config.php');
        try {
            self::assertSame('/srv/plan/config.php', Config::locate(dirname(__DIR__)));
        } finally {
            putenv('PLAN_CONFIG');
        }
    }
}
