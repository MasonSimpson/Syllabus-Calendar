import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

// Ensure the API key is available at runtime
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY in environment");
}

// Declare OpenAI client
const openai = new OpenAI({ apiKey });

export async function GET() {
    try {
        // Simple test to see if OpenAI is working
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: "Hello, world!" }],
        });
        const msg = response.choices[0]?.message?.content || "No response";
        return NextResponse.json({ ok: true, message: msg });
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}