import { Assignment, ParsedSyllabus } from "@/types";
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
});

// TODO: Optimize this prompt - the AI currently takes a very long time to return the .json, could be much faster with a better prompt probably
const SYSTEM_PROMPT = `
You are a syllabus event extractor.

GOAL
Given the full text of a course syllabus, return academic obligations as JSON under {"events":[...]}.
You MUST return events even if the syllabus only lists weeks and day codes (M/Tu/W/Th/F). Use relative fields when dates are missing.

WHAT TO INCLUDE
- Deliverables: assignment, paper, brief, project, report, draft, memo, lab, problem set, portfolio.
- Exams/assessments: quiz, midterm, final, oral/presentation/arguments.
- Class-meeting tasks when no dates exist: readings, case prep, in-class quiz, topic review.
- Multi-day windows/blocks: exam windows, oral argument ranges.

DATES & RELATIVE SCHEDULING
- If absolute dates exist, use them (YYYY-MM-DD). If a time exists, use HH:MM (24h). Otherwise set time_start to null and all_day=true.
- If NO calendar dates exist, STILL emit events with relative fields:
  - "week": integer (1-based)
  - "days": array of codes from {"M","Tu","W","Th","F","Sa","Su"}
  - "class_time": "HH:MM-HH:MM|null" if inferable
  - Set "date_start": null (and "date_end": null)
- If an ANCHOR is supplied in the user message as:
    ANCHOR_WEEK1_MONDAY: YYYY-MM-DD
  convert week/day → absolute dates and set "date_inferred": true.

OUTPUT SCHEMA
Return ONLY:
{
  "events": [
    {
      "title": "string",
      "date_start": "YYYY-MM-DD|null",
      "date_end": "YYYY-MM-DD|null",
      "time_start": "HH:MM|null",
      "time_end": "HH:MM|null",
      "all_day": true|false,
      "timezone": "string|null",
      "location": "string|null",
      "course": "string|null",
      "weighting": "string|null",
      "notes": "string|null",
      "source_excerpt": "string",
      "week": 0|null,
      "days": ["M","Tu","W","Th","F","Sa","Su"] | null,
      "class_time": "string|null",
      "date_inferred": true|false|null
    }
  ]
}

STRICTNESS
- Do NOT skip week/day rows just because they only say readings or topic; emit them as class-meeting tasks when that’s all that exists.
- Prefer concise titles: e.g., "Week 3 — M — Read Ch. 4–5".
- Always include a short "source_excerpt" confirming the event.
`;

export async function POST(req: Request) {

    const isString = (v: unknown): v is string => typeof v === "string";
    const DATE_YMD = /^\d{4}-\d{2}-\d{2}$/;

    type DayCode = "M" | "Tu" | "W" | "Th" | "F" | "Sa" | "Su";

    type ModelEvent = {
        title: string;

        // Absolute data
        date_start?: string | null;
        date_end?: string | null;
        time_start?: string | null;
        time_end?: string | null;
        all_day?: boolean;

        // Relative data
        week?: number | null;
        days?: DayCode[] | null;
        class_time?: string | null;
        date_inferred?: boolean | null;

        // Misc info
        timezone?: string | null;
        location?: string | null;
        course?: string | null;
        weighting?: string | null;
        notes?: string | null;
        source_excerpt?: string | null;
    };

    function isModelEvent(x: unknown): x is ModelEvent {
        if (!x || typeof x !== "object") return false;
        const o = x as Record<string, unknown>;
        const hasTitle = isString(o.title);
        const hasAbs   = isString(o.date_start);
        const hasRel   = typeof o.week === "number" || Array.isArray(o.days);
        return hasTitle && (hasAbs || hasRel);
    }

    function toAssignment(e: ModelEvent): Assignment {
        const ds = e.date_start ?? undefined;
        
        return {
            title: e.title,
            dueDate: ds,
            dueTime: e.all_day ? undefined : (e.time_start ?? undefined),
            notes: (e.notes ?? e.source_excerpt) ?? undefined,
            week: e.week ?? undefined,
            days: e.days ?? undefined,
            classTime: e.class_time ?? undefined,
            dateInferred: e.date_inferred ?? undefined,
        };
    }

    let bodyUnknown: unknown;
    try {
        bodyUnknown = await req.json();
    } catch {
        bodyUnknown = {};
    }
    const body = (bodyUnknown && typeof bodyUnknown === "object")
        ? (bodyUnknown as Record<string, unknown>)
        : {};

    const fullText =
        (isString(body.text) && body.text) ||
        (isString(body.fullText) && body.fullText) ||
        "";
    
    // Debug for fullText
    console.log(
        "[parse] fullText length:", fullText.length,
        "hasBrief:", /APPELATE BRIEF/i.test(fullText),
        "hasOral:", /ORAL ARGUMENTS/i.test(fullText)
    );

    if (!fullText.trim()) {
        return NextResponse.json(
            { ok: false, error: "No text provided" },
            { status: 400 }
        );
    }

    const anchorLine = body.anchorDate ? `\nANCHOR_WEEK1_MONDAY: ${body.anchorDate}\n` : "";

    const FEWSHOT_USER = `EXAMPLE INPUT:
    Week 1
    M: Read Ch.1–3
    W: Case brief workshop
    F: Quiz 1

    Week 7
    M: Midterm (closed book)`;

    const FEWSHOT_ASSISTANT = `{"events":[
        {"title":"Week 1 — M — Read Ch.1–3","date_start":null,"date_end":null,"time_start":null,"time_end":null,"all_day":true,"timezone":null,"location":null,"course":null,"weighting":null,"notes":null,"source_excerpt":"M: Read Ch.1–3","week":1,"days":["M"],"class_time":null,"date_inferred":null},
        {"title":"Week 1 — W — Case brief workshop","date_start":null,"date_end":null,"time_start":null,"time_end":null,"all_day":true,"timezone":null,"location":null,"course":null,"weighting":null,"notes":null,"source_excerpt":"W: Case brief workshop","week":1,"days":["W"],"class_time":null,"date_inferred":null},
        {"title":"Week 1 — F — Quiz 1","date_start":null,"date_end":null,"time_start":null,"time_end":null,"all_day":true,"timezone":null,"location":null,"course":null,"weighting":null,"notes":null,"source_excerpt":"F: Quiz 1","week":1,"days":["F"],"class_time":null,"date_inferred":null},
        {"title":"Week 7 — M — Midterm","date_start":null,"date_end":null,"time_start":null,"time_end":null,"all_day":true,"timezone":null,"location":null,"course":null,"weighting":"15%","notes":"closed book","source_excerpt":"Week 7 — M: Midterm (closed book)","week":7,"days":["M"],"class_time":null,"date_inferred":null}
    ]}`;

    const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: FEWSHOT_USER },
            { role: "assistant", content: FEWSHOT_ASSISTANT },
            {
                role: "user",
                content: `COURSE SYLLABUS FULL TEXT:\n${fullText}${anchorLine}\n\nOUTPUT: {"events":[...]} only.`
            },
        ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";

    // Parse model JSON
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return NextResponse.json(
            { ok: false, error: "Model returned invalid JSON" },
            { status: 500 }
        );
    }

    // Accept either a bare array or { events: [...] }
    const eventsUnknown =
        (parsed && typeof parsed === "object" && "events" in (parsed as Record<string, unknown>))
        ? (parsed as Record<string, unknown>).events
        : parsed;

    const events = Array.isArray(eventsUnknown) ? eventsUnknown : [];
    const valid: ModelEvent[] = events.filter(isModelEvent);
    const assignments: Assignment[] = valid.map(toAssignment);

    return NextResponse.json({ ok: true, syllabus: { assignments } });
}

    