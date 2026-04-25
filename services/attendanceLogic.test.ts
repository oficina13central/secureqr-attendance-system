import assert from 'node:assert/strict';

import {
    classifyCheckIn,
    getDueRecordCount,
    resolveRecalculatedRecord,
    shouldAllowSplitSecondCheckIn
} from './attendanceLogic.ts';

const rules = {
    en_horario: 10,
    llego_tarde: 30,
    ausente_gracia: 120
};

const cases: Array<{ name: string; run: () => void }> = [
    {
        name: 'continuous shift stays en_horario within tolerance',
        run: () => {
            assert.deepEqual(
                classifyCheckIn('2026-04-25T08:08:00', '08:00', rules),
                { status: 'en_horario', minutesLate: 8 }
            );
        }
    },
    {
        name: 'continuous shift becomes tarde after en_horario threshold',
        run: () => {
            assert.deepEqual(
                classifyCheckIn('2026-04-25T08:20:00', '08:00', rules),
                { status: 'tarde', minutesLate: 20 }
            );
        }
    },
    {
        name: 'continuous shift becomes sin_presentismo after llego_tarde threshold',
        run: () => {
            assert.deepEqual(
                classifyCheckIn('2026-04-25T08:45:00', '08:00', rules),
                { status: 'sin_presentismo', minutesLate: 45 }
            );
        }
    },
    {
        name: 'overnight schedule keeps late calculation coherent',
        run: () => {
            assert.deepEqual(
                classifyCheckIn('2026-04-26T01:00:00', '22:00', rules),
                { status: 'sin_presentismo', minutesLate: 180 }
            );
        }
    },
    {
        name: 'continuous shift produces one due absence after grace',
        run: () => {
            assert.equal(
                getDueRecordCount(
                    { type: 'continuous', segments: [{ start: '08:00', end: '16:00' }] },
                    '2026-04-25',
                    '2026-04-25',
                    new Date('2026-04-25T10:30:00'),
                    120
                ),
                1
            );
        }
    },
    {
        name: 'split shift only owes the first segment before second grace expires',
        run: () => {
            assert.equal(
                getDueRecordCount(
                    { type: 'split', segments: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '18:00' }] },
                    '2026-04-25',
                    '2026-04-25',
                    new Date('2026-04-25T11:00:00'),
                    120
                ),
                1
            );
        }
    },
    {
        name: 'split shift owes both segments after both grace windows expire',
        run: () => {
            assert.equal(
                getDueRecordCount(
                    { type: 'split', segments: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '18:00' }] },
                    '2026-04-25',
                    '2026-04-25',
                    new Date('2026-04-25T16:30:00'),
                    120
                ),
                2
            );
        }
    },
    {
        name: 'days off do not generate due attendance records',
        run: () => {
            assert.equal(
                getDueRecordCount({ type: 'off', segments: [] }, '2026-04-25', '2026-04-25', new Date('2026-04-25T16:30:00'), 120),
                0
            );
        }
    },
    {
        name: 'vacation and medical days generate a single status record',
        run: () => {
            assert.equal(
                getDueRecordCount({ type: 'vacation', segments: [] }, '2026-04-25', '2026-04-25', new Date('2026-04-25T09:00:00'), 120),
                1
            );
            assert.equal(
                getDueRecordCount({ type: 'medical', segments: [] }, '2026-04-25', '2026-04-25', new Date('2026-04-25T09:00:00'), 120),
                1
            );
        }
    },
    {
        name: 'second split absence stays provisional before its own grace',
        run: () => {
            assert.equal(
                resolveRecalculatedRecord(
                    { date: '2026-04-25', check_in: null, status: 'ausente', minutes_late: 0 },
                    { type: 'split', segments: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '18:00' }] },
                    1,
                    rules,
                    '2026-04-25',
                    new Date('2026-04-25T15:00:00')
                ).shouldDelete,
                true
            );
        }
    },
    {
        name: 'second split absence becomes ausente after its own grace',
        run: () => {
            assert.deepEqual(
                resolveRecalculatedRecord(
                    { date: '2026-04-25', check_in: null, status: 'pendiente', minutes_late: 12 },
                    { type: 'split', segments: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '18:00' }] },
                    1,
                    rules,
                    '2026-04-25',
                    new Date('2026-04-25T16:30:00')
                ),
                { shouldDelete: false, status: 'ausente', minutesLate: 0 }
            );
        }
    },
    {
        name: 'off, vacation and medical schedules map to descanso, vacaciones and licencia_medica',
        run: () => {
            assert.deepEqual(
                resolveRecalculatedRecord(
                    { date: '2026-04-24', check_in: null, status: 'ausente', minutes_late: 0 },
                    { type: 'off' },
                    0,
                    rules,
                    '2026-04-25',
                    new Date('2026-04-25T10:00:00')
                ),
                { shouldDelete: false, status: 'descanso', minutesLate: 0 }
            );
            assert.deepEqual(
                resolveRecalculatedRecord(
                    { date: '2026-04-24', check_in: null, status: 'ausente', minutes_late: 0 },
                    { type: 'vacation' },
                    0,
                    rules,
                    '2026-04-25',
                    new Date('2026-04-25T10:00:00')
                ),
                { shouldDelete: false, status: 'vacaciones', minutesLate: 0 }
            );
            assert.deepEqual(
                resolveRecalculatedRecord(
                    { date: '2026-04-24', check_in: null, status: 'ausente', minutes_late: 0 },
                    { type: 'medical' },
                    0,
                    rules,
                    '2026-04-25',
                    new Date('2026-04-25T10:00:00')
                ),
                { shouldDelete: false, status: 'licencia_medica', minutesLate: 0 }
            );
        }
    },
    {
        name: 'second split check-in is evaluated against the second segment',
        run: () => {
            assert.deepEqual(
                resolveRecalculatedRecord(
                    { date: '2026-04-25', check_in: '2026-04-25T14:15:00', status: 'manual', minutes_late: 0 },
                    { type: 'split', segments: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '18:00' }] },
                    1,
                    rules,
                    '2026-04-25',
                    new Date('2026-04-25T16:30:00')
                ),
                { shouldDelete: false, status: 'tarde', minutesLate: 15 }
            );
        }
    },
    {
        name: 'forced second check-in stays blocked before the 60 minute early window',
        run: () => {
            assert.equal(
                shouldAllowSplitSecondCheckIn(
                    { type: 'split', segments: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '18:00' }] },
                    new Date('2026-04-25T12:50:00'),
                    60
                ),
                false
            );
        }
    },
    {
        name: 'forced second check-in opens 60 minutes before the second split segment',
        run: () => {
            assert.equal(
                shouldAllowSplitSecondCheckIn(
                    { type: 'split', segments: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '18:00' }] },
                    new Date('2026-04-25T13:00:00'),
                    60
                ),
                true
            );
        }
    },
    {
        name: 'forced second check-in also stays open after the second segment starts',
        run: () => {
            assert.equal(
                shouldAllowSplitSecondCheckIn(
                    { type: 'split', segments: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '18:00' }] },
                    new Date('2026-04-25T14:20:00'),
                    60
                ),
                true
            );
        }
    },
    {
        name: 'forced second check-in remains blocked for continuous schedules',
        run: () => {
            assert.equal(
                shouldAllowSplitSecondCheckIn(
                    { type: 'continuous', segments: [{ start: '08:00', end: '16:00' }] },
                    new Date('2026-04-25T15:00:00'),
                    60
                ),
                false
            );
        }
    }
];

let passed = 0;
for (const scenario of cases) {
    scenario.run();
    passed++;
    console.log(`ok - ${scenario.name}`);
}

console.log(`\n${passed}/${cases.length} attendance logic checks passed`);
