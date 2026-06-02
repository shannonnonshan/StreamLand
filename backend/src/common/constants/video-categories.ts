const VIDEO_CATEGORY_ALIASES: Record<string, string> = {
  'Toan hoc': 'Mathematics',
  'Lap trinh': 'Computer Science',
  'Tieng Anh': 'English',
  'Vat ly': 'Physics',
  'Hoa hoc': 'Chemistry',
  'Sinh hoc': 'Biology',
  'Lich su': 'History',
  'Dia ly': 'Geography',
  'Van hoc': 'Literature',
  'Ky nang mem': 'Other',
  'Data Science': 'Computer Science',
  'AI/ML': 'Computer Science',
};

export const normalizeVideoCategory = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const alias = VIDEO_CATEGORY_ALIASES[trimmed];
  if (alias) {
    return alias;
  }

  return trimmed;
};
