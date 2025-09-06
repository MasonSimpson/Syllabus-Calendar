import { NextResponse } from "next/server";  

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("syllabus");

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