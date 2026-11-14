<?php

declare(strict_types=1);

namespace VacationPlanner\Api\Tests;

use VacationPlanner\Api\Response;
use VacationPlanner\Api\Tests\Support\ApiTestCase;

/** The secret calendar link: POST /api/plan/keys {which: calendar} and GET /api/calendar/<key>.ics. */
final class CalendarTest extends ApiTestCase
{
    private const PLAN = [
        'v' => 1,
        's' => 'BE',
        'p' => [['n' => 'Maren', 'w' => [1, 2, 3, 4, 5]], ['n' => 'Tobias', 'w' => [1, 2, 3, 4]]],
        'e' => [
            ['2026-10-19', '2026-10-29', 1, 3, 'Frankreich', 'Fähre; Hund, Katze'],
            ['2026-10-30', '2026-10-30', 0, 4, '', ''],
            ['2026-08-01', '2026-08-10', 1, 3, 'Idee Ostsee', '', 1],
            ['2026-12-31', '2026-12-01', 1, 3, 'kaputt', ''],
            'kein Eintrag',
        ],
        'x' => [[1, '2026-11-02', '2026-11-03', 0, '', '']],
        'd' => [['2027-01-29', '2027-01-29', 'Zeugnisausgabe Halbjahr 2027']],
    ];

    private function calendarKey(?string $editKey = null): string
    {
        $r = $this->call('POST', '/api/plan/keys', ['which' => 'calendar'], self::bearer($editKey ?? $this->editKey()), auth: false);
        self::assertSame(200, $r->status);

        return $this->data($r)['key'];
    }

    private function feed(string $key): Response
    {
        return $this->call('GET', '/api/calendar/' . $key . '.ics', headers: ['Host' => 'vacation.ingsparks.de'], auth: false);
    }

    private function save(array $data): void
    {
        $r = $this->call('PUT', '/api/plan', ['data' => $data], ['If-None-Match' => '*']);
        self::assertSame(200, $r->status);
    }

    /** The feed with folded lines joined again. */
    private static function unfolded(Response $r): string
    {
        return str_replace("\r\n ", '', $r->body);
    }

    public function testFeedListsFixedPeriodsLeaveAndSchoolFreeDays(): void
    {
        $this->save(self::PLAN);
        $r = $this->feed($this->calendarKey());

        self::assertSame(200, $r->status);
        self::assertSame('text/calendar; charset=utf-8', $r->header('Content-Type'));
        self::assertSame('no-store', $r->header('Cache-Control'));
        self::assertStringStartsWith("BEGIN:VCALENDAR\r\n", $r->body);
        foreach (explode("\r\n", rtrim($r->body)) as $line) {
            self::assertLessThanOrEqual(75, strlen($line), $line);
        }

        $ics = self::unfolded($r);
        self::assertSame(4, substr_count($ics, 'BEGIN:VEVENT'), 'ideas and broken items are left out');
        self::assertStringContainsString("DTSTART;VALUE=DATE:20261019\r\nDTEND;VALUE=DATE:20261030\r\nSUMMARY:Urlaubsplan: Frankreich\r\n", $ics);
        self::assertStringContainsString('Betreuung: Maren\, Tobias\nNotiz: Fähre\; Hund\, Katze', $ics);
        self::assertStringContainsString('SUMMARY:Urlaubsplan: Zu Hause', $ics);
        self::assertStringContainsString('Betreuung: Großeltern', $ics);
        self::assertStringContainsString('SUMMARY:Urlaubsplan: Tobias Urlaub', $ics);
        self::assertStringContainsString('SUMMARY:Urlaubsplan: Schulfrei – Zeugnisausgabe Halbjahr 2027', $ics);
        self::assertStringContainsString('URL:https://vacation.ingsparks.de/?year=2026&from=2026-10-19&to=2026-10-29', $ics);
        self::assertStringNotContainsString('Idee Ostsee', $ics);
    }

    public function testFeedNeverContainsAnyKey(): void
    {
        $this->save(self::PLAN);
        $calendarKey = $this->calendarKey();
        $ics = self::unfolded($this->feed($calendarKey));

        foreach ([$this->editKey(), $this->viewKey(), $calendarKey] as $key) {
            self::assertStringNotContainsString($key, $ics);
        }
    }

    public function testEmptyPlanGivesAnEmptyCalendar(): void
    {
        $r = $this->feed($this->calendarKey());
        self::assertSame(200, $r->status);
        self::assertStringNotContainsString('BEGIN:VEVENT', $r->body);
        self::assertStringEndsWith("END:VCALENDAR\r\n", $r->body);
    }

    public function testRenewingReplacesTheCalendarKey(): void
    {
        $old = $this->calendarKey();
        $new = $this->calendarKey();

        self::assertNotSame($old, $new);
        self::assertSame(404, $this->feed($old)->status, 'the old calendar link stops working at once');
        self::assertSame(200, $this->feed($new)->status);
        self::assertSame(1, (int) $this->db->one('SELECT COUNT(*) AS n FROM calendar_feeds')['n']);
    }

    public function testCalendarKeyOpensNothingElse(): void
    {
        $key = $this->calendarKey();
        $r = $this->call('GET', '/api/plan', headers: self::bearer($key), auth: false);
        self::assertSame(401, $r->status);
    }

    public function testOnlyTheEditRoleMakesACalendarLink(): void
    {
        $r = $this->call('POST', '/api/plan/keys', ['which' => 'calendar'], self::bearer($this->viewKey()), auth: false);
        self::assertSame(403, $r->status);
    }

    public function testUnknownOrMalformedKeysAre404(): void
    {
        self::assertSame(404, $this->feed(str_repeat('a', 43))->status);
        self::assertSame(404, $this->call('GET', '/api/calendar/short.ics', auth: false)->status);
        self::assertSame(405, $this->call('POST', '/api/calendar/' . str_repeat('a', 43) . '.ics', auth: false)->status);
    }

    public function testEachPlanHasItsOwnFeed(): void
    {
        $this->save(self::PLAN);
        $other = $this->newPlan();
        $ics = $this->feed($this->calendarKey($other['editKey']))->body;
        self::assertStringNotContainsString('Frankreich', $ics);
    }
}
