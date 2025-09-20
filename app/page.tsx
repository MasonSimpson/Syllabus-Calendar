"use client";

// Main upload page with form to submit syllabus file

import { useState, Fragment } from "react";

type DayCode = "Su" | "M" | "Tu" | "W" | "Th" | "F" | "Sa";

type Assignment = {
    title: string;
    dueDate?: string; 
    dueTime?: string;
    notes?: string;
    week?: number;
    days?: string[];
    classTime?: string;
};

type ParsedSyllabus = {
    course?: string;
    semester?: string;
    assignments: Assignment[];
};

export default function UploadPage() {
    // State for upload status, error messages, and parsed data
    const [status, setStatus] = useState<"idle" | "uploading" | "parsing" | "done" | "error">("idle");
    const [error, setError] = useState<string>("");
    const [parsed, setParsed] = useState<ParsedSyllabus | null>(null);

    // Handle form submission
    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setStatus("uploading");
        setError("");
        setParsed(null);

        const form = e.currentTarget
        const fd = new FormData(form);

        try {
            // Upload the file to /api/upload
            const uploadRes = await fetch("/api/upload", {
                method: "POST",
                body: fd,
            });

            // Check for upload errors
            if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.statusText}`);
            const { text } = await uploadRes.json();
            // Ensure we got some text
            if (!text) throw new Error("No text extracted from syllabus");

            // Send extracted text to /api/parse
            setStatus("parsing");
            const parseRes = await fetch("/api/parse", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text }),
            });

            // Check for parse errors
            if (!parseRes.ok) throw new Error(`Parse failed: ${parseRes.statusText}`);

            const parsedJson = await parseRes.json();
            
            // Pull nested syllabus out of the response
            const syllabus: ParsedSyllabus = parsedJson?.syllabus ?? { assignments: [] };
            setParsed(syllabus);

            setStatus("done");
            form.reset();

        } catch (err) {
            const message = err instanceof Error ? err.message : "Upload/parse failed";
            setStatus("error");
            setError(message);
        }
    }

    return (
        <main> 
            <h1>Syllabus → Calendar </h1>
            <p>Upload your syllabus file to generate a calendar.</p>
            <p>Created by Mason Simpson</p>

            <form onSubmit={handleSubmit}>
                <input type="file" name="syllabus" accept=".pdf,.docx,.txt" required />
                <button type="submit" disabled={status === "uploading" || status === "parsing"}>
                    {status === "uploading" 
                        ? "Uploading..." 
                        : status === "parsing"
                        ? "Parsing..."
                        : "Upload"}
                </button>
            </form>
            
            {status === "uploading" && <p>Uploading file…</p>}
            {status === "parsing" && <p>Generating calendar…</p>}
            
            {status === "done" && <p>Success! {parsed?.assignments?.length || 0} assignments.</p>}
            {status === "error" && <p style={{ color: "red" }}>Error: {error}</p>}

            {parsed && parsed.assignments?.length > 0 && (
                <section>
                    <h2>Assignments</h2>
                    <CalendarGrid assignments={parsed.assignments} />
                </section>
            )}
        </main>
    );        
}

// TODO: Have this calendar sync with Google Calendar
function CalendarGrid({ assignments }: { assignments: Assignment[] }) {
    // Constants and helpers
    const DAY_ORDER = ["M", "Tu", "W", "Th", "F", "Sa", "Su"] as const;

    const dayFromISO = (iso: string): string => {
        const d = new Date(`${iso}T00:00:00`);
        return ["Su", "M", "Tu", "W", "Th", "F", "Sa"][d.getDay()];
    };

    // Normalize all items so that they each have days[]
    const normalized = assignments.map((a) => {
        const days =
            a.days && a.days.length
            ? a.days
            : a.dueDate
            ? [dayFromISO(a.dueDate)]
            : [];
        return { ...a, days };
    });

    // Generate rows for columns and weeks
    const usedDays = DAY_ORDER.filter((d) =>
        normalized.some((a) => a.days?.includes(d))
    );
    const cols: readonly string[] = usedDays.length ? usedDays : ["M", "W", "F"];

    const weeks = Array.from(
        new Set(normalized.map((a) => (typeof a.week === "number" ? a.week : 0)))
    ).sort((a, b) => a - b);

    // Place items into cells
    const byCell = new Map<string, Assignment[]>();
    const key = (w: number, d: string) => `${w}|${d}`;

    for (const a of normalized) {
        const wk = typeof a.week === "number" ? a.week : 0;

        const daysArr = a.days ?? [];
        if (daysArr.length === 0) {
            const firstCol = cols[0] ?? "M";
            const k = key(wk, firstCol);
            if (!byCell.has(k)) byCell.set(k, []);
            byCell.get(k)!.push(a);
            continue;
        }

        for (const d of daysArr) {
            if (!cols.includes(d)) continue;
            const k = key(wk, d);
            if (!byCell.has(k)) byCell.set(k, []);
            byCell.get(k)!.push(a);
        }
    }

    // Styles
    const gridStyle: React.CSSProperties = {
        display: "grid",
        gridTemplateColumns: `120px repeat(${cols.length}, minmax(180px, 1fr))`,
        gap: 10,
        alignItems: "start",
    };
    const headCell: React.CSSProperties = {
        fontWeight: 700,
        textAlign: "center",
        padding: "8px 6px",
    };
    const weekCell: React.CSSProperties = {
        fontWeight: 700,
        padding: "8px 6px",
        textAlign: "right",
    };
    const cell: React.CSSProperties = {
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.2)",
        borderRadius: 10,
        padding: 8,
        minHeight: 80,
    };
    const pill: React.CSSProperties = {
        background: "rgba(255,255,255,0.9)",
        borderRadius: 8,
        padding: "6px 8px",
        marginBottom: 6,
        color: "#111",
        lineHeight: 1.15,
        boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
    };
    const titleCss: React.CSSProperties = { fontWeight: 700 };
    const metaCss: React.CSSProperties = { fontSize: 12, opacity: 0.8, marginTop: 2 };

    return (
        <div style={{ marginTop: 16 }}>
            <div style={gridStyle}>
                {/* header row */}
                <div />
                {cols.map((d) => (
                    <div key={`h-${d}`} style={headCell}>
                        {d}
                    </div>
                ))}

                {/* week rows */}
                {weeks.map((w) => (
                    <Fragment key={`row-${w}`}>
                        <div style={weekCell}>{w === 0 ? "Other" : `Week ${w}`}</div>
                        {cols.map((d) => {
                            const items = byCell.get(key(w, d)) || [];
                            return (
                                <div key={`c-${w}-${d}`} style={cell}>
                                    {items.length === 0 && (
                                        <div style={{ opacity: 0.5, fontSize: 12 }}>—</div>
                                    )}
                                    {items.map((a, i) => (
                                        <div key={i} style={pill}>
                                            <div style={titleCss}>{a.title}</div>
                                            <div style={metaCss}>
                                                {a.dueDate ? a.dueDate : ""}
                                                {a.dueTime ? ` • ${a.dueTime}` : ""}
                                                {a.classTime ? ` • ${a.classTime}` : ""}
                                                {a.notes ? ` • ${a.notes}` : ""}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </Fragment>
                ))}
            </div>
        </div>
    );
}