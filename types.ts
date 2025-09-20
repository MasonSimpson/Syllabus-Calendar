export type DayCode = "M" | "Tu" | "W" | "Th" | "F" | "Sa" | "Su";

// Assignment structure
export type Assignment = {
    title: string;
    dueDate?: string;
    dueTime?: string | undefined;
    notes?: string | undefined;
    week?: number;
    days?: DayCode[];
    classTime?: string;
    dateInferred?: boolean;
};

// Parsed syllabus structure
export type ParsedSyllabus = {
    course?: string;
    semester?: string; // e.g., "Fall 2025"
    assignments: Assignment[]; // List of assignments
};