<?php

declare(strict_types=1);

namespace VacationPlanner\Api\Tests;

use PHPUnit\Framework\Attributes\DataProvider;
use VacationPlanner\Api\Response;
use VacationPlanner\Api\Tests\Support\ApiTestCase;

final class PlanTest extends ApiTestCase
{
    private const FIRST = ['v' => 1, 'trips' => [['name' => 'Ostsee', 'from' => '2027-07-01']]];
    private const SECOND = ['v' => 1, 'trips' => [['name' => 'Harz', 'from' => '2027-10-03']]];

    /** PUT with a JSON object as data. */
    private function put(mixed $data, array $headers = [], bool $auth = true): Response
    {
        return $this->call('PUT', '/api/plan', ['data' => $data], $headers, auth: $auth);
    }

    private function create(array $data = self::FIRST): Response
    {
        $r = $this->put($data, ['If-None-Match' => '*']);
        self::assertSame(200, $r->status);

        return $r;
    }

    public function testReadWithoutPlanReturnsNullPlan(): void
    {
        $r = $this->call('GET', '/api/plan');
        self::assertSame(200, $r->status);
        self::assertSame(['role' => 'edit', 'plan' => null], $this->data($r));
        self::assertNull($r->header('ETag'));
    }

    public function testTheTwoPlansOfTwoFamiliesAreIsolated(): void
    {
        $a = $this->newPlan();
        $b = $this->newPlan();
        self::assertNotSame($a['editKey'], $b['editKey']);

        $putA = $this->call('PUT', '/api/plan', ['data' => self::FIRST], ['If-None-Match' => '*', ...self::bearer($a['editKey'])], auth: false);
        self::assertSame(200, $putA->status);

        // B does not see A's plan, and A's data is not B's.
        $getB = $this->call('GET', '/api/plan', headers: self::bearer($b['editKey']), auth: false);
        self::assertSame(['role' => 'edit', 'plan' => null], $this->data($getB));
        self::assertNull($getB->header('ETag'));
        $getBView = $this->call('GET', '/api/plan', headers: self::bearer($b['viewKey']), auth: false);
        self::assertSame(['role' => 'view', 'plan' => null], $this->data($getBView));

        // B creates its own first version: it is not a conflict with A's plan.
        $putB = $this->call('PUT', '/api/plan', ['data' => self::SECOND], ['If-None-Match' => '*', ...self::bearer($b['editKey'])], auth: false);
        self::assertSame(200, $putB->status);
        self::assertSame(1, $this->data($putB)['version']);

        // B updates and A's version does not move.
        $this->call('PUT', '/api/plan', ['data' => ['v' => 1, 'trips' => []]], ['If-Match' => '"1"', ...self::bearer($b['editKey'])], auth: false);
        $planA = $this->data($this->call('GET', '/api/plan', headers: self::bearer($a['viewKey']), auth: false))['plan'];
        self::assertSame(1, $planA['version']);
        self::assertSame(self::FIRST, $planA['data']);
        $planB = $this->data($this->call('GET', '/api/plan', headers: self::bearer($b['viewKey']), auth: false))['plan'];
        self::assertSame(2, $planB['version']);

        // A's view key is read only for A: B's data can not be written with it either.
        $deny = $this->call('PUT', '/api/plan', ['data' => self::SECOND], ['If-Match' => '"2"', ...self::bearer($a['viewKey'])], auth: false);
        self::assertSame(403, $deny->status);
        self::assertSame(2, $this->data($this->call('GET', '/api/plan', headers: self::bearer($b['viewKey']), auth: false))['plan']['version']);
    }

    public function testViewAndEditRoleOfEachPlan(): void
    {
        foreach ([$this->newPlan(), $this->newPlan()] as $keys) {
            self::assertSame('edit', $this->data($this->call('GET', '/api/plan', headers: self::bearer($keys['editKey']), auth: false))['role']);
            self::assertSame('view', $this->data($this->call('GET', '/api/plan', headers: self::bearer($keys['viewKey']), auth: false))['role']);
        }
    }

    public function testCreateWithIfNoneMatchStoresThePlan(): void
    {
        $r = $this->put(self::FIRST, ['If-None-Match' => '*']);
        self::assertSame(200, $r->status);
        self::assertSame(['version' => 1, 'updatedAt' => '2026-05-10T12:00:00.000Z'], $this->data($r));
        self::assertSame('"1"', $r->header('ETag'));

        $get = $this->call('GET', '/api/plan');
        self::assertSame('"1"', $get->header('ETag'));
        $plan = $this->data($get);
        self::assertSame('edit', $plan['role']);
        self::assertSame(1, $plan['plan']['version']);
        self::assertSame('2026-05-10T12:00:00.000Z', $plan['plan']['updatedAt']);
        self::assertSame(self::FIRST, $plan['plan']['data']);
    }

    public function testUpdateWithIfMatchIncrementsVersion(): void
    {
        $this->create();

        $r = $this->put(self::SECOND, ['If-Match' => '"1"']);
        self::assertSame(200, $r->status);
        self::assertSame(2, $this->data($r)['version']);
        self::assertSame('"2"', $r->header('ETag'));

        $plan = $this->data($this->call('GET', '/api/plan'))['plan'];
        self::assertSame(2, $plan['version']);
        self::assertSame(self::SECOND, $plan['data']);
    }

    /** @return iterable<string, array{string}> */
    public static function ifMatchForms(): iterable
    {
        yield 'quoted' => ['"1"'];
        yield 'weak' => ['W/"1"'];
        yield 'bare' => ['1'];
    }

    #[DataProvider('ifMatchForms')]
    public function testIfMatchAcceptsQuotedWeakAndBareVersions(string $ifMatch): void
    {
        $this->create();
        self::assertSame(200, $this->put(self::SECOND, ['If-Match' => $ifMatch])->status);
    }

    public function testStaleIfMatchIs409WithTheCurrentPlan(): void
    {
        $this->create();
        $this->put(self::SECOND, ['If-Match' => '"1"']);

        $stale = $this->put(['v' => 1, 'trips' => []], ['If-Match' => '"1"']);
        self::assertSame(409, $stale->status);
        $body = $this->data($stale);
        self::assertSame('conflict', $body['error']);
        self::assertSame(2, $body['plan']['version']);
        self::assertSame(self::SECOND, $body['plan']['data']);
        self::assertSame('"2"', $stale->header('ETag'));

        // The stale write did not change anything.
        self::assertSame(self::SECOND, $this->data($this->call('GET', '/api/plan'))['plan']['data']);
    }

    public function testGarbageIfMatchIsAStalePrecondition(): void
    {
        $this->create();
        $r = $this->put(self::SECOND, ['If-Match' => '*']);
        self::assertSame(409, $r->status);
        self::assertSame(1, $this->data($r)['plan']['version']);
    }

    public function testCreateOverExistingPlanIs409WithThePlan(): void
    {
        $this->create();

        $r = $this->put(self::SECOND, ['If-None-Match' => '*']);
        self::assertSame(409, $r->status);
        $body = $this->data($r);
        self::assertSame(1, $body['plan']['version']);
        self::assertSame(self::FIRST, $body['plan']['data']);
        self::assertSame(self::FIRST, $this->data($this->call('GET', '/api/plan'))['plan']['data']);
    }

    public function testWriteWithoutPreconditionIs428AndStoresNothing(): void
    {
        $r = $this->put(self::FIRST);
        self::assertSame(428, $r->status);
        self::assertSame(['error' => 'precondition_required'], $r->data());

        $r = $this->put(self::FIRST, ['If-None-Match' => '"1"']);
        self::assertSame(428, $r->status, 'If-None-Match only counts as create with *');

        self::assertNull($this->data($this->call('GET', '/api/plan'))['plan']);
    }

    public function testIfMatchWithoutAPlanIs409WithNullPlan(): void
    {
        $r = $this->put(self::FIRST, ['If-Match' => '"1"']);
        self::assertSame(409, $r->status);
        self::assertSame(['error' => 'conflict', 'plan' => null], $r->data());
    }

    public function testViewKeyReadsButCannotWrite(): void
    {
        $this->create();

        $get = $this->call('GET', '/api/plan', headers: self::bearer($this->viewKey()), auth: false);
        self::assertSame(200, $get->status);
        $body = $this->data($get);
        self::assertSame('view', $body['role']);
        self::assertSame(self::FIRST, $body['plan']['data']);

        $put = $this->put(self::SECOND, ['If-Match' => '"1"', 'Authorization' => 'Bearer ' . $this->viewKey()]);
        self::assertSame(403, $put->status);
        self::assertSame(['error' => 'forbidden'], $put->data());

        $create = $this->put(self::SECOND, ['If-None-Match' => '*', 'Authorization' => 'Bearer ' . $this->viewKey()]);
        self::assertSame(403, $create->status);

        self::assertSame(self::FIRST, $this->data($this->call('GET', '/api/plan'))['plan']['data']);
    }

    public function testBodyOver64KiBIs413AndStoresNothing(): void
    {
        $r = $this->put(['big' => str_repeat('a', 64 * 1024)], ['If-None-Match' => '*']);
        self::assertSame(413, $r->status);
        self::assertSame(['error' => 'payload_too_large'], $r->data());
        self::assertNull($this->data($this->call('GET', '/api/plan'))['plan']);
    }

    public function testMalformedJsonIs400(): void
    {
        $r = $this->call('PUT', '/api/plan', rawBody: '{"data":', headers: ['If-None-Match' => '*']);
        self::assertSame(400, $r->status);
        self::assertSame(['error' => 'invalid_json'], $r->data());
    }

    public function testEmptyBodyIs400(): void
    {
        $r = $this->call('PUT', '/api/plan', rawBody: '', headers: ['If-None-Match' => '*']);
        self::assertSame(400, $r->status);
        self::assertSame(['error' => 'invalid_json'], $r->data());
    }

    /** @return iterable<string, array{string}> */
    public static function nonObjectBodies(): iterable
    {
        yield 'data is a list' => ['{"data":[1,2]}'];
        yield 'data is an empty list' => ['{"data":[]}'];
        yield 'data is a string' => ['{"data":"x"}'];
        yield 'data is a number' => ['{"data":3}'];
        yield 'data is null' => ['{"data":null}'];
        yield 'no data' => ['{}'];
        yield 'body is a list' => ['[]'];
        yield 'body is a string' => ['"plan"'];
    }

    #[DataProvider('nonObjectBodies')]
    public function testNonObjectDataIs422(string $body): void
    {
        $r = $this->call('PUT', '/api/plan', rawBody: $body, headers: ['If-None-Match' => '*']);
        self::assertSame(422, $r->status);
        self::assertSame(['error' => 'invalid_plan'], $r->data());
        self::assertNull($this->data($this->call('GET', '/api/plan'))['plan']);
    }

    public function testDataIsStoredAndReturnedUnchanged(): void
    {
        $data = ['v' => 1, 'trips' => [['name' => 'Ü/Ostsee', 'days' => 1.5, 'ok' => true, 'none' => null]], 'empty' => new \stdClass()];
        $this->call('PUT', '/api/plan', rawBody: json_encode(['data' => $data], JSON_THROW_ON_ERROR), headers: ['If-None-Match' => '*']);

        $plan = $this->data($this->call('GET', '/api/plan'))['plan'];
        self::assertSame(['v' => 1, 'trips' => [['name' => 'Ü/Ostsee', 'days' => 1.5, 'ok' => true, 'none' => null]], 'empty' => []], $plan['data']);
    }

    public function testUpdatedAtFollowsTheClock(): void
    {
        $this->create();
        $this->now = $this->now->modify('+5 seconds');

        $r = $this->put(self::SECOND, ['If-Match' => '"1"']);

        self::assertSame(200, $r->status);
        self::assertSame('2026-05-10T12:00:05.000Z', $this->data($r)['updatedAt']);
        self::assertSame('2026-05-10T12:00:05.000Z', $this->data($this->call('GET', '/api/plan'))['plan']['updatedAt']);
    }
}
