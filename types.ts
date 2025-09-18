// Assignment structure
export type Assignment = {
    title: string;
    dueDate: string; // YYYY-MM-DD
    dueTime?: string; // HH:MM (24h)
    notes?: string;
};

// Parsed syllabus structure
export type ParsedSyllabus = {
    course?: string;
    semester?: string; // e.g., "Fall 2025"
    assignments: Assignment[]; // List of assignments
};