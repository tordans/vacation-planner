<?php

declare(strict_types=1);

namespace VacationPlanner\Api;

/**
 * Renders a plan (wire format, see src/features/plan/plan-wire.ts) as an iCalendar feed for
 * calendar apps. This is the only place where the server reads the plan: family periods,
 * each parent's own leave and the family's own school-free days, all as all-day events.
 * Ideas and other households are left out. Malformed items are skipped, never an error.
 */
final class CalendarFeed
{
    /** Short prefix of every event title, so it is clear where the event comes from. */
    public const PREFIX = 'Urlaubsplan: ';

    private const CARERS = ['mother', 'father', 'grandparents'];

    /**
     * @param mixed $data the stored plan (decoded JSON, assoc arrays) or null before the first save
     * @param string $appUrl e.g. https://vacation.ingsparks.de (no trailing slash); the deep links
     *                       point there and never contain a key
     */
    public static function render(mixed $data, string $planId, string $appUrl, \DateTimeImmutable $now): string
    {
        $host = parse_url($appUrl, PHP_URL_HOST) ?: 'localhost';
        $stamp = $now->setTimezone(new \DateTimeZone('UTC'))->format('Ymd\THis\Z');
        $lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//' . $host . '//Urlaubsplan//DE',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:' . self::text('Urlaubsplan (' . $host . ')'),
            'X-WR-CALDESC:' . self::text('Familienplan von ' . $host . '. Bearbeiten nur in der App: ' . $appUrl . '/'),
            'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
            'X-PUBLISHED-TTL:PT6H',
        ];

        foreach (self::events(is_array($data) ? $data : []) as $event) {
            $deepLink = sprintf(
                '%s/?year=%s&from=%s&to=%s',
                $appUrl,
                substr($event['start'], 0, 4),
                $event['start'],
                $event['end'],
            );
            $description = array_merge($event['details'], [
                '',
                'Aus dem Familienplan auf ' . $host . '. Ansehen und bearbeiten: ' . $deepLink,
                '(Der Link öffnet den Plan auf Geräten, auf denen er schon gespeichert ist.)',
            ]);
            $uid = hash('sha256', implode('|', [$planId, $event['type'], $event['start'], $event['end'], $event['title']]));
            array_push(
                $lines,
                'BEGIN:VEVENT',
                'UID:' . substr($uid, 0, 32) . '@' . $host,
                'DTSTAMP:' . $stamp,
                'DTSTART;VALUE=DATE:' . str_replace('-', '', $event['start']),
                'DTEND;VALUE=DATE:' . (new \DateTimeImmutable($event['end']))->modify('+1 day')->format('Ymd'),
                'SUMMARY:' . self::text(self::PREFIX . $event['title']),
                'DESCRIPTION:' . self::text(implode("\n", $description)),
                'URL:' . $deepLink,
                'TRANSP:TRANSPARENT',
                'END:VEVENT',
            );
        }
        $lines[] = 'END:VCALENDAR';

        return implode("\r\n", array_map(self::fold(...), $lines)) . "\r\n";
    }

    /**
     * @param array<mixed> $plan
     * @return list<array{type: string, start: string, end: string, title: string, details: list<string>}>
     */
    private static function events(array $plan): array
    {
        $parents = [];
        foreach ([0 => 'Mutter', 1 => 'Vater'] as $index => $fallback) {
            $name = $plan['p'][$index]['n'] ?? '';
            $parents[] = is_string($name) && trim($name) !== '' ? trim($name) : $fallback;
        }
        $carerNames = [$parents[0], $parents[1], 'Großeltern'];

        $events = [];
        foreach (self::items($plan, 'e') as $item) {
            [$start, $end, $kind, $mask, $place, $note, $idea] = array_pad($item, 7, null);
            if ($idea === 1 || !self::range($start, $end)) {
                continue;
            }
            $place = self::str($place);
            $title = $kind === 1 ? ($place !== '' ? $place : 'Unterwegs') : 'Zu Hause' . ($place !== '' ? ' – ' . $place : '');
            $carers = [];
            foreach (self::CARERS as $bit => $_) {
                if (is_int($mask) && ($mask & (1 << $bit)) !== 0) {
                    $carers[] = $carerNames[$bit];
                }
            }
            $details = [$kind === 1 ? 'Familie unterwegs' : 'Familie zu Hause'];
            if ($carers !== []) {
                $details[] = 'Betreuung: ' . implode(', ', $carers);
            }
            if (self::str($note) !== '') {
                $details[] = 'Notiz: ' . self::str($note);
            }
            $events[] = ['type' => 'family', 'start' => $start, 'end' => $end, 'title' => $title, 'details' => $details];
        }

        foreach (self::items($plan, 'x') as $item) {
            [$parent, $start, $end, $kind, $place, $note] = array_pad($item, 6, null);
            if (($parent !== 0 && $parent !== 1) || !self::range($start, $end)) {
                continue;
            }
            $place = self::str($place);
            $title = $parents[$parent] . ' Urlaub' . ($place !== '' ? ' – ' . $place : '');
            $details = ['Eigener Urlaub von ' . $parents[$parent] . ($kind === 1 ? ', unterwegs' : ', zu Hause')];
            if (self::str($note) !== '') {
                $details[] = 'Notiz: ' . self::str($note);
            }
            $events[] = ['type' => 'leave', 'start' => $start, 'end' => $end, 'title' => $title, 'details' => $details];
        }

        foreach (self::items($plan, 'd') as $item) {
            [$start, $end, $name] = array_pad($item, 3, null);
            if (!self::range($start, $end)) {
                continue;
            }
            $name = self::str($name);
            $events[] = [
                'type' => 'schoolfree',
                'start' => $start,
                'end' => $end,
                'title' => 'Schulfrei' . ($name !== '' ? ' – ' . $name : ''),
                'details' => ['Eigener schulfreier Tag der Familie'],
            ];
        }

        usort($events, static fn (array $a, array $b): int => [$a['start'], $a['end']] <=> [$b['start'], $b['end']]);

        return $events;
    }

    /**
     * @param array<mixed> $plan
     * @return list<list<mixed>>
     */
    private static function items(array $plan, string $field): array
    {
        $items = $plan[$field] ?? [];

        return is_array($items) ? array_values(array_filter($items, static fn (mixed $item): bool => is_array($item) && array_is_list($item))) : [];
    }

    /** @phpstan-assert-if-true string $start @phpstan-assert-if-true string $end */
    private static function range(mixed $start, mixed $end): bool
    {
        return self::isDay($start) && self::isDay($end) && $start <= $end;
    }

    private static function isDay(mixed $value): bool
    {
        if (!is_string($value) || preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) !== 1) {
            return false;
        }
        [$y, $m, $d] = array_map('intval', explode('-', $value));

        return checkdate($m, $d, $y);
    }

    private static function str(mixed $value): string
    {
        return is_string($value) ? trim(preg_replace('/[\x00-\x08\x0B-\x1F\x7F]/u', '', $value) ?? '') : '';
    }

    /** TEXT value escaping (RFC 5545, 3.3.11). */
    private static function text(string $value): string
    {
        return str_replace(['\\', ';', ',', "\r\n", "\n"], ['\\\\', '\\;', '\\,', '\\n', '\\n'], $value);
    }

    /** Folds a content line at 75 octets without splitting a UTF-8 character. */
    private static function fold(string $line): string
    {
        $out = '';
        $limit = 75;
        while (strlen($line) > $limit) {
            $cut = $limit;
            while ($cut > 0 && (ord($line[$cut]) & 0xC0) === 0x80) {
                $cut--;
            }
            $out .= substr($line, 0, $cut) . "\r\n ";
            $line = substr($line, $cut);
            $limit = 74;
        }

        return $out . $line;
    }
}
