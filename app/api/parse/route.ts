import { ParsedSyllabus } from "@/types";
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
});

const SYSTEM_PROMPT = `
You extract a machine-readable calendar from a college course syllabus. 

Return ONLY JSON in the exact format specified, with no extra text or formatting.

type Assignment = {
    title: string;           
    dueDate: string;        // YYYY-MM-DD
    dueTime?: string;       // HH:MM (24h)
    notes?: string;         // Optional additional notes
};
type ParsedSyllabus = {
    course?: string;
    semester?: string;      // e.g., "Fall 2025"
    assignments: Assignment[]; // List of assignments
};

Rules:
- Include only assignments with specific due dates. Do NOT include vague tasks like "read chapter 1".
- Use ISO dates (YYYY-MM-DD) and 24-hour times (HH:MM). If you cannot determine an exact date or time, omit the item.
- Do NOT guess or fabricate times. If time is not present, omit dueTime.
- Prefer the main lecture setion if multiple sections differ.
- Output valid JSON and NOTHING ELSE.
`;

export async function POST(req: Request) {
    console.log("API key present?", !!process.env.OPENAI_API_KEY);
    if (process.env.OPENAI_API_KEY) {   
        const k = process.env.OPENAI_API_KEY;
        console.log("API key length:", k.length);
        console.log("Sample:", k.slice(0, 7) + "..." + k.slice(-4));
        console.log("Has trailing space?", /\s$/.test(k));
    }
    try {
        const { text } = (await req.json()) as { text: string };
        const fullText = (text || "").trim();

        if (!fullText) {
            return NextResponse.json({ 
                ok: false, error: "No text provided" }, 
                { status: 400 } // 400 Bad Request
            );
        }

        // Heuristic: keep likely schedule lines to reduce token usage
        const filtered = fullText
            .split(/\r?\n/)
            .filter((line) => /schedule|calendar|week|due|assignment|exam|quiz/i.test(line))
            .join("\n")
            .slice(0, 12000); // Limit to 12k chars

        // Use filtered text if it has at least 300 chars, else use start of full text
        const input = filtered.length > 300 ? filtered : fullText.slice(0, 12000);

        // Call OpenAI to parse the syllabus text
        const completion = await client.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: `Here is the syllabus text:\n\n${input}` },
            ],
        });

        // Extract the raw JSON string from the response
        const raw = completion.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(raw) as ParsedSyllabus;

        // Basic validation of the parsed result
        if (!parsed || !Array.isArray(parsed.assignments)) {
            return NextResponse.json(
                { ok: false, error: "Unexpected model output" },
                { status: 422 } // 422 Unprocessable Entity
            );
        }

        parsed.assignments = parsed.assignments.filter(
            (a: any) =>
                typeof a?.title === "string" &&
                typeof a?.dueDate === "string" &&
                /^\d{4}-\d{2}-\d{2}$/.test(a.dueDate) // Basic date format check
        );

        return NextResponse.json({ ok: true, syllabus: parsed });
    } catch (err) {
        console.error("Parse error:", err);
        const msg = err instanceof Error ? err.message : "Parse error";
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });  
    }
}
    