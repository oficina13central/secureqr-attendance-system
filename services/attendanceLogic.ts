export type AttendanceRulesLike = {
    en_horario: number;
    llego_tarde: number;
    ausente_gracia?: number;
};

export type ScheduleSegmentLike = {
    start: string;
    end?: string;
};

export type ScheduleLike = {
    type?: 'continuous' | 'split' | 'off' | 'vacation' | 'medical';
    segments?: ScheduleSegmentLike[];
};

export type AttendanceRecordLike = {
    date: string;
    check_in: string | null;
    status: string;
    minutes_late: number;
};

const getMinutesFromTimeString = (value: string) => {
    const [hours, minutes] = value.split(':').map(Number);
    return (hours * 60) + minutes;
};

export const shouldAllowSplitSecondCheckIn = (
    schedule: ScheduleLike | null | undefined,
    now: Date,
    earlyWindowMinutes = 60
) => {
    const segments = schedule?.segments || [];
    const isSplitShift = schedule?.type === 'split' || segments.length > 1;
    if (!isSplitShift || segments.length < 2) return false;

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const secondSegmentStart = getMinutesFromTimeString(segments[1].start);
    return currentMinutes >= (secondSegmentStart - earlyWindowMinutes);
};

export const classifyCheckIn = (
    checkInIso: string,
    segmentStart: string,
    rules: AttendanceRulesLike
): { status: 'en_horario' | 'tarde' | 'sin_presentismo'; minutesLate: number } => {
    const checkInDate = new Date(checkInIso);
    const checkInMinutes = checkInDate.getHours() * 60 + checkInDate.getMinutes();
    const scheduledMinutes = getMinutesFromTimeString(segmentStart);

    let diffInMinutes = checkInMinutes - scheduledMinutes;
    if (diffInMinutes < -600) diffInMinutes += 1440;

    const minutesLate = diffInMinutes > 0 ? diffInMinutes : 0;
    if (minutesLate > rules.llego_tarde) {
        return { status: 'sin_presentismo', minutesLate };
    }
    if (minutesLate > rules.en_horario) {
        return { status: 'tarde', minutesLate };
    }
    return { status: 'en_horario', minutesLate };
};

export const shouldDeletePrematureAbsence = (
    recordDate: string,
    segmentStart: string | undefined,
    todayStr: string,
    now: Date,
    gracePeriod: number
) => {
    if (recordDate !== todayStr || !segmentStart) return false;

    const shiftStart = new Date(now);
    const [hours, minutes] = segmentStart.split(':').map(Number);
    shiftStart.setHours(hours, minutes, 0, 0);

    const minutesSinceStart = (now.getTime() - shiftStart.getTime()) / 60000;
    return minutesSinceStart < gracePeriod;
};

export const getDueRecordCount = (
    schedule: ScheduleLike | null | undefined,
    dateStr: string,
    todayStr: string,
    now: Date,
    gracePeriod: number
) => {
    if (!schedule || schedule.type === 'off') return 0;
    if (schedule.type === 'vacation' || schedule.type === 'medical') return 1;

    const segments = schedule.segments || [];
    if (segments.length === 0) return 0;

    if (dateStr !== todayStr) return segments.length;

    return segments.reduce((count, segment) => {
        const shouldExist = !shouldDeletePrematureAbsence(dateStr, segment.start, todayStr, now, gracePeriod);
        return count + (shouldExist ? 1 : 0);
    }, 0);
};

export const resolveRecalculatedRecord = (
    record: AttendanceRecordLike,
    schedule: ScheduleLike | null | undefined,
    segmentIndex: number,
    rules: AttendanceRulesLike,
    todayStr: string,
    now: Date
): { shouldDelete: boolean; status: string; minutesLate: number } => {
    let status = record.status;
    let minutesLate = record.minutes_late;

    if (!schedule) return { shouldDelete: false, status, minutesLate };

    if (schedule.type === 'off') return { shouldDelete: false, status: 'descanso', minutesLate: 0 };
    if (schedule.type === 'vacation') return { shouldDelete: false, status: 'vacaciones', minutesLate: 0 };
    if (schedule.type === 'medical') return { shouldDelete: false, status: 'licencia_medica', minutesLate: 0 };

    const scheduledSegment = schedule.segments?.[segmentIndex] || schedule.segments?.[0];

    if (record.check_in && scheduledSegment?.start) {
        const classified = classifyCheckIn(record.check_in, scheduledSegment.start, rules);
        return { shouldDelete: false, status: classified.status, minutesLate: classified.minutesLate };
    }

    const gracePeriod = rules.ausente_gracia || 120;
    const shouldDelete = shouldDeletePrematureAbsence(record.date, scheduledSegment?.start, todayStr, now, gracePeriod);
    if (shouldDelete) {
        return { shouldDelete: true, status, minutesLate };
    }

    return { shouldDelete: false, status: 'ausente', minutesLate: 0 };
};
