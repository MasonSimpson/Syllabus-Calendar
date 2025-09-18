"use client";

// Main upload page with form to submit syllabus file

import { useState } from "react";

type Assignment = {
    title: string;
    dueDate: string; 
    dueTime?: string;
    notes?: string;
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
            setParsed(parsedJson);

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

            {status === "done" && <p>Success! {parsed?.assignments?.length || 0} assignments.</p>}
            {status === "error" && <p style={{ color: "red" }}>Error: {error}</p>}

            {parsed && parsed.assignments?.length > 0 && (
                <section>
                    <h2>Assignments</h2>
                    <ul>
                        {parsed.assignments.map((a, i) => (
                            <li key={i}>
                                <strong>{a.title}</strong> - {a.dueDate}
                                {a.dueTime ? ` at ${a.dueTime}` : ""} {a.notes ? ` (${a.notes})` : ""}
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </main>
    );        
}