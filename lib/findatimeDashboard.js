const { listMeetings } = require('./meetingStore');
const { getVisitorsByDay, shanghaiDateKey } = require('./findatimeAdminStore');

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfShanghaiDay(dateKey) {
  return Date.parse(`${dateKey}T00:00:00+08:00`);
}

function dateKeyFromTimestamp(timestamp) {
  return shanghaiDateKey(new Date(timestamp));
}

function dateRange(startKey, endKey) {
  const dates = [];
  for (let time = startOfShanghaiDay(startKey); time <= startOfShanghaiDay(endKey); time += DAY_MS) {
    dates.push(shanghaiDateKey(new Date(time)));
  }
  return dates;
}

function startKeyForDays(todayKey, days) {
  return shanghaiDateKey(new Date(startOfShanghaiDay(todayKey) - (days - 1) * DAY_MS));
}

async function buildDashboard() {
  const [meetings, visitorsByDay] = await Promise.all([
    listMeetings(),
    getVisitorsByDay()
  ]);
  const todayKey = shanghaiDateKey();
  const meetingEvents = meetings
    .filter(meeting => !Number.isNaN(Date.parse(meeting.createdAt)))
    .map(meeting => ({ meeting, date: dateKeyFromTimestamp(meeting.createdAt) }));
  const participantEvents = meetings.flatMap(meeting => (meeting.participants || [])
    .filter(participant => !Number.isNaN(Date.parse(participant.submittedAt)))
    .map(participant => ({
      meetingId: meeting.id,
      date: dateKeyFromTimestamp(participant.submittedAt)
    })));

  const periods = [
    { key: 'today', label: '今天', days: 1 },
    { key: '7d', label: '最近 7 天', days: 7 },
    { key: '30d', label: '最近 30 天', days: 30 },
    { key: '365d', label: '最近 365 天', days: 365 }
  ].map(period => {
    const startKey = startKeyForDays(todayKey, period.days);
    const meetingsInPeriod = meetingEvents.filter(event => event.date >= startKey && event.date <= todayKey);
    const participantsInPeriod = participantEvents.filter(event => event.date >= startKey && event.date <= todayKey);
    const uniqueVisitors = new Set();
    Object.entries(visitorsByDay).forEach(([date, visitorIds]) => {
      if (date >= startKey && date <= todayKey) {
        (visitorIds || []).forEach(visitorId => uniqueVisitors.add(visitorId));
      }
    });
    return {
      ...period,
      startDate: startKey,
      endDate: todayKey,
      meetingCount: meetingsInPeriod.length,
      visitorCount: uniqueVisitors.size,
      participantCount: participantsInPeriod.length
    };
  });

  const meetingRecords = meetingEvents
    .sort((a, b) => Date.parse(b.meeting.createdAt) - Date.parse(a.meeting.createdAt))
    .map(({ meeting }) => ({
      id: meeting.id,
      createdAt: meeting.createdAt,
      participantCount: (meeting.participants || []).length,
      title: meeting.title
    }));

  const availableDates = [
    todayKey,
    ...meetingEvents.map(event => event.date),
    ...participantEvents.map(event => event.date),
    ...Object.keys(visitorsByDay)
  ].sort();
  const allDates = dateRange(availableDates[0], todayKey);
  const chart = allDates.map(date => ({
    date,
    meetings: meetingEvents.filter(event => event.date === date).length,
    visitors: new Set(visitorsByDay[date] || []).size,
    participants: participantEvents.filter(event => event.date === date).length
  }));

  return {
    generatedAt: new Date().toISOString(),
    timezone: 'Asia/Shanghai',
    periods,
    meetings: meetingRecords,
    chart
  };
}

module.exports = { buildDashboard };
