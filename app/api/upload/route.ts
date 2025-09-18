import { NextResponse } from "next/server";
import * as mammoth from "mammoth"; // Parses .docx files locally instead of sending whole file to OpenAI

export const runtime = "nodejs";

// Simple check for each file type based on MIME type and file extension
function looksLikePDF(mime: string, name: string) {
    return mime.includes("pdf") || name.endsWith(".pdf");
}
function looksLikeDocx(mime: string, name: string) {
    return (
        mime.includes("word") || mime.includes("officedocument") || name.endsWith(".docx")
    );
}
function looksLikeTxt(mime: string, name: string) {
    return mime.includes("text/") || name.endsWith(".txt");
}

// Handle file upload via POST request
export async function POST(req: Request) {
    try {
        // Parse the incoming form data
        const formData = await req.formData();
        const file = formData.get("syllabus");

        // Validate the file
        if (!file || !(file instanceof File)) {
            return NextResponse.json({ok: false, error: "No file uploaded" }, { status: 400 });
        }

        // Read file info
        const name = (file.name || "").toLowerCase();
        const mime = (file.type || "").toLowerCase();
        const buf = Buffer.from(await file.arrayBuffer());

        // Set up variable for extracted text
        let text = "";

        // Handle file based on type
        if (looksLikePDF(mime, name)) {
            // Dynamically import pdf-parse only when needed
            // @ts-expect-error pdf-parse has no types
            const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
            const parsed = await pdfParse(buf);
            text = parsed.text || "";
        }
        else if (looksLikeDocx(mime, name)) {
            const parsed = await mammoth.extractRawText({ buffer: buf });
            text = parsed.value || "";
        }
        else if (looksLikeTxt(mime, name)) {
            text = buf.toString("utf-8");
        }
        else {
            return NextResponse.json({ 
                ok: false, 
                error: "Unsupported file type. Must upload PDF, DOCX, or TXT." }, 
                { status: 415 } // 415 Unsupported Media Type
            ); 
        }

        text = text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").trim(); // Clean up whitespace

        // Ensure we got some text
        if (!text) {
            return NextResponse.json(
                { ok: false, error: "Failed to extract text from file" },
                { status: 422 } // 422 Unprocessable Entity
            );
        }

        // Return the full text (client can preview a snipper and send to /api/parse)
        return NextResponse.json({ ok: true, text });
    } catch (err) {
        console.error("Upload error:", err);
        return NextResponse.json({ ok: false, error: "Upload failed" }, { status: 500 });
    }
}