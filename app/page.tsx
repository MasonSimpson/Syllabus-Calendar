"use client";

// Upload syllabus file and display status messages

import { useState } from "react";

export default function UploadPage() {
    const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
    const [error, setError] = useState<string>("");

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setStatus("uploading");
        setError("");

        const form = e.currentTarget
        const fd = new FormData(form);

        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                body: fd,
            });

            if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
            setStatus("done");
            form.reset();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Upload failed";
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
                <input type="file" name="syllabus" accept=".pdf,.doc,.docx,.txt" required />
                <button type="submit" disabled={status === "uploading"}>
                    {status === "uploading" ? "Uploading..." : "Upload"}
                </button>
            </form>
            {status === "done" && <p>Upload successful!</p>}
            {status === "error" && <p style={{ color: "red" }}>Error: {error}</p>}
        </main>
    );        
}