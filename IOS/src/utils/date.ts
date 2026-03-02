export function toDisplayDate(dateValue: string | null | undefined): string {
  if (!dateValue) {
    return "No date";
  }

  const parsed = new Date(dateValue);
  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(parsed);
  }

  const monthMatch = /^(\d{4})-(\d{2})$/.exec(dateValue.trim());
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    if (month >= 1 && month <= 12) {
      return new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
      }).format(new Date(Date.UTC(year, month - 1, 1)));
    }
  }

  return dateValue;
}

export function formatPopupTimeRange(startIso?: string | null, endIso?: string | null): string {
  if (!startIso || !endIso) {
    return "Time unavailable";
  }

  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Time unavailable";
  }

  const timeOpts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };

  const startTime = start.toLocaleTimeString("en-US", timeOpts);
  const endTime = end.toLocaleTimeString("en-US", timeOpts);

  if (start.toDateString() === new Date().toDateString()) {
    return `Today · ${startTime} - ${endTime}`;
  }

  const date = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${date} · ${startTime} - ${endTime}`;
}

export function toEventIso(value: string): string | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

export function toLocalDatetimeInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
