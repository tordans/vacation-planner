<?php

declare(strict_types=1);

namespace VacationPlanner\Api\Handler;

use VacationPlanner\Api\CalendarFeed;
use VacationPlanner\Api\Db;
use VacationPlanner\Api\HttpException;
use VacationPlanner\Api\Keys;
use VacationPlanner\Api\Request;
use VacationPlanner\Api\Response;

/**
 * GET /api/calendar/<key>.ics: the plan as an iCalendar feed. The key in the path is the secret
 * (calendar apps cannot send headers); it only reads the feed, it never opens the plan itself.
 */
final class CalendarHandler
{
    /** @param \Closure(): \DateTimeImmutable $clock */
    public function __construct(private readonly Db $db, private readonly \Closure $clock)
    {
    }

    public function feed(Request $request, string $key): Response
    {
        $row = $this->db->one(
            'SELECT p.id, p.data FROM calendar_feeds f JOIN plans p ON p.id = f.plan_id WHERE f.key_sha256 = ?',
            [Keys::hash($key)],
        );
        if ($row === null) {
            throw new HttpException(404, 'not_found');
        }
        $data = $row['data'] === null ? null : json_decode((string) $row['data'], true, 64);

        return new Response(200, CalendarFeed::render($data, (string) $row['id'], self::appUrl($request), ($this->clock)()), [
            'Content-Type' => 'text/calendar; charset=utf-8',
            'Content-Disposition' => 'inline; filename="urlaubsplan.ics"',
        ]);
    }

    /** Origin of the app, from the Host header (same host serves app and API). */
    private static function appUrl(Request $request): string
    {
        $host = strtolower(trim((string) $request->header('host')));
        if (preg_match('/^[a-z0-9.-]+(:\d{1,5})?$/', $host) !== 1) {
            $host = 'vacation.ingsparks.de';
        }
        $local = preg_match('/^(localhost|127\.0\.0\.1)(:\d+)?$/', $host) === 1;

        return ($local ? 'http://' : 'https://') . $host;
    }
}
