<?php

declare(strict_types=1);

namespace VacationPlanner\Api\Handler;

use Closure;
use stdClass;
use VacationPlanner\Api\Db;
use VacationPlanner\Api\HttpException;
use VacationPlanner\Api\Request;
use VacationPlanner\Api\Response;

/**
 * GET and PUT /api/plan: the one shared plan (table `plan`, row id 1).
 *
 * `data` is stored as JSON text and returned unchanged; the server only checks that it is a JSON
 * object. Writes are conditional: If-Match with the current version updates, If-None-Match: *
 * creates. A stale version or an existing plan on create gives 409 with the current plan.
 */
final class PlanHandler
{
    private const ROW_ID = 1;
    private const JSON_FLAGS = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION | JSON_THROW_ON_ERROR;

    /** @param Closure(): \DateTimeImmutable $clock */
    public function __construct(private readonly Db $db, private readonly Closure $clock)
    {
    }

    /** @param string $role 'edit' or 'view' */
    public function get(string $role): Response
    {
        $row = $this->current();
        if ($row === null) {
            return Response::json(200, ['role' => $role, 'plan' => null]);
        }

        return Response::raw(200, '{"role":' . json_encode($role) . ',"plan":' . self::planJson($row) . '}', self::etag($row));
    }

    /** @param string $role 'edit' or 'view' (only edit may write) */
    public function put(Request $request, string $role): Response
    {
        if ($role !== 'edit') {
            throw new HttpException(403, 'forbidden');
        }

        $ifMatch = $request->header('if-match');
        $createOnly = $ifMatch === null && trim((string) $request->header('if-none-match')) === '*';
        if ($ifMatch === null && !$createOnly) {
            throw new HttpException(428, 'precondition_required');
        }

        $body = $request->json(false);
        if (!$body instanceof stdClass || !isset($body->data) || !$body->data instanceof stdClass) {
            throw new HttpException(422, 'invalid_plan');
        }

        $json = json_encode($body->data, self::JSON_FLAGS);
        $now = ($this->clock)();
        $stamp = $now->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s.v');

        return $createOnly
            ? $this->create($json, $stamp, $now)
            : $this->update((string) $ifMatch, $json, $stamp, $now);
    }

    private function create(string $json, string $stamp, \DateTimeImmutable $now): Response
    {
        try {
            $this->db->run(
                'INSERT INTO plan (id, data, version, updated_at) VALUES (?, ?, 1, ?)',
                [self::ROW_ID, $json, $stamp],
            );
        } catch (\PDOException $e) {
            if (!Db::isUniqueViolation($e)) {
                throw $e;
            }

            return $this->conflict();
        }

        return Response::json(200, ['version' => 1, 'updatedAt' => self::iso($now)], ['ETag' => self::quote(1)]);
    }

    private function update(string $ifMatch, string $json, string $stamp, \DateTimeImmutable $now): Response
    {
        $row = $this->current();
        $expected = self::parseVersion($ifMatch);
        if ($row === null || $expected === null || (int) $row['version'] !== $expected) {
            return $this->conflict();
        }

        $changed = $this->db->run(
            'UPDATE plan SET data = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?',
            [$json, $stamp, self::ROW_ID, $expected],
        );
        if ($changed !== 1) {
            // Someone saved between the read and the write.
            return $this->conflict();
        }

        return Response::json(
            200,
            ['version' => $expected + 1, 'updatedAt' => self::iso($now)],
            ['ETag' => self::quote($expected + 1)],
        );
    }

    /** 409 with the current plan (or null when there is none). */
    private function conflict(): Response
    {
        $row = $this->current();

        return Response::raw(
            409,
            '{"error":"conflict","plan":' . ($row === null ? 'null' : self::planJson($row)) . '}',
            $row === null ? [] : self::etag($row),
        );
    }

    /** @return array<string, mixed>|null */
    private function current(): ?array
    {
        return $this->db->one('SELECT data, version, updated_at FROM plan WHERE id = ?', [self::ROW_ID]);
    }

    /** "3", W/"3" and 3 all mean version 3; anything else is null (a stale precondition). */
    private static function parseVersion(string $value): ?int
    {
        $v = trim($value);
        if (str_starts_with($v, 'W/')) {
            $v = substr($v, 2);
        }
        $v = trim($v, '"');

        return ctype_digit($v) && strlen($v) <= 9 ? (int) $v : null;
    }

    /** The plan object as JSON text, with the stored data text embedded unchanged. */
    private static function planJson(array $row): string
    {
        $updatedAt = new \DateTimeImmutable((string) $row['updated_at'], new \DateTimeZone('UTC'));

        return '{"version":' . (int) $row['version']
            . ',"updatedAt":' . json_encode(self::iso($updatedAt))
            . ',"data":' . $row['data'] . '}';
    }

    /** @return array<string, string> */
    private static function etag(array $row): array
    {
        return ['ETag' => self::quote((int) $row['version'])];
    }

    private static function quote(int $version): string
    {
        return '"' . $version . '"';
    }

    /** ISO 8601 UTC with milliseconds, e.g. 2026-05-10T12:00:00.000Z. */
    private static function iso(\DateTimeInterface $at): string
    {
        return \DateTimeImmutable::createFromInterface($at)->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d\TH:i:s.v\Z');
    }
}
