function normalizeName(value) {
  return String(value || '').trim().slice(0, 40);
}

function meetingStats(meeting) {
  const participants = meeting.participants || [];
  const counts = Object.fromEntries(meeting.slots.map(slot => [slot.id, 0]));
  const attendees = Object.fromEntries(meeting.slots.map(slot => [slot.id, []]));
  const unavailableAttendees = [];

  participants.forEach(person => {
    if (person.unavailable === true) {
      unavailableAttendees.push(person.name);
      return;
    }
    [...new Set(person.availability || [])].forEach(slotId => {
      if (!Object.prototype.hasOwnProperty.call(counts, slotId)) return;
      counts[slotId] += 1;
      attendees[slotId].push(person.name);
    });
  });

  return { participants, counts, attendees, unavailableAttendees };
}

function publicMeeting(meeting) {
  const { participants, counts, attendees, unavailableAttendees } = meetingStats(meeting);
  return {
    id: meeting.id,
    title: meeting.title,
    duration: meeting.duration,
    timezone: meeting.timezone,
    createdAt: meeting.createdAt,
    slots: meeting.slots.map(slot => ({
      ...slot,
      votes: counts[slot.id],
      attendees: attendees[slot.id]
    })),
    unavailable: {
      count: unavailableAttendees.length,
      attendees: unavailableAttendees
    },
    participantCount: participants.length
  };
}

module.exports = {
  normalizeName,
  publicMeeting
};
