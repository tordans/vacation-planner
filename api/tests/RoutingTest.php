<?php

declare(strict_types=1);

namespace VacationPlanner\Api\Tests;

use VacationPlanner\Api\App;
use VacationPlanner\Api\Logger;
use VacationPlanner\Api\Request;
use VacationPlanner\Api\Tests\Support\ApiTestCase;

final class RoutingTest extends ApiTestCase
{
    public function testHealthNeedsNoAuthAndReturnsCommit(): void
    {
        $r = $this->call('GET', '/api/health', auth: false);
        self::assertSame(200, $r->status);
        self::assertSame(['ok' => true, 'commit' => 'abc1234'], $r->data());
        self::assertSame('no-store', $r->header('Cache-Control'));
        self::assertStringStartsWith('application/json', (string) $r->header('Content-Type'));
    }

    public function testHealthWorksWithoutDatabase(): void
    {
        $app = new App(
            $this->config(),
            fn () => throw new \RuntimeException('no db'),
            fn () => $this->now,
            new Logger('/dev/null'),
            $this->migrationsDir,
        );
        self::assertSame(200, $app->handle(new Request('GET', '/api/health'))->status);
    }

    public function testUnknownRouteIs404Json(): void
    {
        $r = $this->call('GET', '/api/nope');
        self::assertSame(404, $r->status);
        self::assertSame(['error' => 'not_found'], $r->data());
        self::assertSame(404, $this->call('GET', '/other', auth: false)->status);
    }

    public function testTrailingSlashIsAccepted(): void
    {
        self::assertSame(200, $this->call('GET', '/api/health/', auth: false)->status);
    }

    public function testWrongMethodIs405WithAllowHeader(): void
    {
        $r = $this->call('DELETE', '/api/plan');
        self::assertSame(405, $r->status);
        self::assertSame('GET, PUT', $r->header('Allow'));
    }

    public function testBodyOver64KiBIs413(): void
    {
        $r = $this->call('PUT', '/api/plan', rawBody: str_repeat('a', 64 * 1024 + 1), headers: ['If-None-Match' => '*']);
        self::assertSame(413, $r->status);
        self::assertSame(['error' => 'payload_too_large'], $r->data());
    }

    public function testBodyOfExactly64KiBIsNotRejectedForSize(): void
    {
        $r = $this->call('PUT', '/api/plan', rawBody: str_repeat('a', 64 * 1024), headers: ['If-None-Match' => '*']);
        self::assertSame(400, $r->status); // size ok, but not JSON
    }

    public function testDeclaredContentLengthOverLimitIs413(): void
    {
        $r = $this->app->handle(new Request('PUT', '/api/plan', ['Authorization' => 'Bearer ' . self::EDIT_KEY], [], '', 3 * 1024 * 1024));
        self::assertSame(413, $r->status);
    }

    public function testTruncatedBodyIs413(): void
    {
        $r = $this->app->handle(new Request('PUT', '/api/plan', ['Authorization' => 'Bearer ' . self::EDIT_KEY], [], 'x', null, true));
        self::assertSame(413, $r->status);
    }

    public function testNoCorsHeaderIsSentForRequestWithOrigin(): void
    {
        $r = $this->call('GET', '/api/health', headers: ['Origin' => 'http://localhost:5173'], auth: false);
        self::assertSame(200, $r->status);
        self::assertNull($r->header('Access-Control-Allow-Origin'));
    }

    public function testOptionsOnKnownRouteIs405WithAllowHeader(): void
    {
        $r = $this->call('OPTIONS', '/api/plan', auth: false);
        self::assertSame(405, $r->status);
        self::assertSame('GET, PUT', $r->header('Allow'));
    }

    public function testOptionsOnUnknownRouteIs404(): void
    {
        self::assertSame(404, $this->call('OPTIONS', '/api/nope', auth: false)->status);
    }

    public function testUnexpectedErrorsAreGenericAndDoNotLeak(): void
    {
        $app = new App(
            $this->config(),
            fn () => throw new \RuntimeException('secret detail'),
            fn () => $this->now,
            new Logger('/dev/null'),
            $this->migrationsDir,
        );
        $r = $app->handle(new Request('GET', '/api/plan', ['Authorization' => 'Bearer ' . self::EDIT_KEY]));
        self::assertSame(500, $r->status);
        self::assertSame(['error' => 'internal_error'], $r->data());
        self::assertStringNotContainsString('secret detail', $r->body);
    }
}
