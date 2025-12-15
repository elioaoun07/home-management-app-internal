// Static birthdays data
// Add your birthdays here - they will appear on the calendar every year

export interface Birthday {
  id: string;
  name: string;
  month: number; // 1-12
  day: number; // 1-31
  category: "family" | "friends" | "work" | "community";
  year?: number; // Optional: birth year for age calculation
}

export const BIRTHDAYS: Birthday[] = [
  {
    id: "bd-1",
    name: "Rach's Day",
    month: 1,
    day: 1,
    category: "family",
    year: 1996,
  },
  {
    id: "bd-2",
    name: "Elio's Day",
    month: 2,
    day: 28,
    category: "family",
    year: 1995,
  },
  // Add more birthdays here
  {
    id: "bd-3",
    name: "Rebecca's Birthday",
    month: 12,
    day: 16,
    category: "friends",
    //year: ,
  },

  // {
  //   id: "bd-4",
  //   name: "Sister's Birthday",
  //   month: 11,
  //   day: 8,
  //   category: "family",
  //   year: 1998,
  // },
];

// Helper function to get birthdays for a specific date
export function getBirthdaysForDate(date: Date): Birthday[] {
  const month = date.getMonth() + 1; // JavaScript months are 0-indexed
  const day = date.getDate();

  return BIRTHDAYS.filter(
    (birthday) => birthday.month === month && birthday.day === day
  );
}

// Helper function to calculate age
export function calculateAge(
  birthday: Birthday,
  currentYear: number
): number | null {
  if (!birthday.year) return null;
  return currentYear - birthday.year;
}

// Helper function to get ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
function getOrdinalSuffix(num: number): string {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

// Helper function to format birthday display name with age
export function getBirthdayDisplayName(birthday: Birthday, date: Date): string {
  const age = calculateAge(birthday, date.getFullYear());

  if (age === null) {
    return birthday.name;
  }

  const ordinal = getOrdinalSuffix(age);
  return `${birthday.name}'s ${age}${ordinal}`;
}
