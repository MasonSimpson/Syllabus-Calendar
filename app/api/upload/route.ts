import { NextResponse } from "next/server";  

export const runtime = "nodejs";

// Ensure the API key is available at runtime
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY in environment");
}

// Handle file upload via POST request
export async function POST(req: Request) {
    try {
        // Parse the incoming form data
        const formData = await req.formData();
        const file = formData.get("syllabus");

        // Validate the file
        if (!file || !(file instanceof Blob)) {
            return NextResponse.json({ok: false, error: "No file uploaded" }, { status: 400 });
        }

        // TODO: Process the file. For now just reads the file into memory and logs its size.
        const bytes = await file.arrayBuffer();
        console.log(`Received file of ${bytes.byteLength} bytes`);

        return NextResponse.json({ ok: true, message: "File uploaded successfully" });
    } catch (err) {
        console.error("Upload error:", err);
        return NextResponse.json({ ok: false, error: "Upload failed" }, { status: 500 });
    }
}