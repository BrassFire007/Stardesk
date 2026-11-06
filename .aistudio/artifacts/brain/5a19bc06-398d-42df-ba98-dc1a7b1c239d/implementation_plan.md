# Beacon AI Whiteboard Vision & Problem Solver

Add a dedicated Beacon AI Vision button to the Whiteboard toolbar that captures the screen/drawing, instantly analyzes handwritten math, physics, chemistry, diagrams, or questions, and displays a step-by-step solution in an interactive floating bottom sheet with follow-up doubt resolution.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following user preferences were confirmed during Phase 1 clarification:
> - **Display Mode**: **Floating bottom sheet modal** with smooth slide-up animation, drag handle, formatted step-by-step solution, and full LaTeX formula rendering ($...$ and $$...$$).
> - **Interaction Flow**: **Instant solve upon tap** with an optional follow-up chat input at the bottom of the modal so students can ask clarifying questions without leaving their whiteboard work.

- **Confirmed Decision 1**: Add an eye-catching Beacon AI button (`Sparkles` icon with an indigo/violet accent) to the Whiteboard floating bottom toolbar.
- **Confirmed Decision 2**: When tapped, the app captures the full whiteboard canvas snapshot using `canvas.toDataURL('image/jpeg', 0.85)` (rendering white background for dark mode if needed to optimize OCR accuracy), immediately opening the solution bottom sheet in streaming state.
- **Confirmed Decision 3**: The solution streams live via the server-side `/api/gemini/stream` endpoint with automatic high-demand fallback (`gemini-3.8-flash` -> `gemini-3.1-flash-lite`).
- **Confirmed Decision 4**: Students can minimize or close the bottom sheet to continue drawing, or ask follow-up questions (e.g., "explain step 2 in more detail") in the same conversational session.

---

## 1. Overview & Core Concept

- **What It Does**: Students write or sketch any problem, formula, equation, geometry diagram, or handwritten doubt on their whiteboard, tap **Ask Beacon**, and Beacon AI visually inspects their work, extracts the problem, and delivers an organized, step-by-step mathematical explanation.
- **Target Audience**: Students working through homework, practice exam questions, or conceptual derivations on mobile, tablet, or desktop.
- **Key Value**: Eliminates the tedious step of saving an image, switching to the Doubt tab, and uploading. It turns the Whiteboard into an active, intelligent scratchpad.

---

## 2. User Experience & Visual Design

- **Toolbar Integration**:
  - The toolbar receives a distinct, animated Beacon AI action button:
    `[ Pen ] [ Eraser ] | [ ✨ Ask Beacon ] | [ Clear ] [ Download ]`
  - Styled with a subtle gradient/indigo glow (`bg-indigo-600 text-white shadow-md shadow-indigo-500/20 active:scale-95`) that stands out cleanly without clashing with the pen controls.
- **Floating Solution Bottom Sheet**:
  - **Structure**: Slides up from the bottom (`max-h-[85vh]` on mobile, centered modal card on desktop `max-w-2xl`).
  - **Header**: Includes a drag handle, Beacon AI badge with sparkle icon, whiteboard thumbnail preview of what was captured, and a close/minimize button.
  - **Body**: Smooth real-time streaming text with `ReactMarkdown`, `remarkMath`, and `rehypeKatex` for crisp mathematical typography.
  - **Follow-Up Bar**: Embedded `MessageBar` at the bottom of the sheet allowing the student to send follow-up questions referencing the solution while viewing their canvas.
  - **Retry & Error Handling**: In-place retry button if connection drops or network fails.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Full Canvas vs. Viewport Capture**:
  - *Chosen Approach*: Capture the active drawn strokes on a clean 2D canvas rendered at native 1x resolution with a clean background.
  - *Why*: Ensures Beacon AI sees all handwritten equations clearly, even if the student is currently zoomed out or in, preventing blurred or cropped formulas.
- **Decision 2: Server-Side Streaming Route**:
  - *Chosen Approach*: Reuses the hardened `/api/gemini/stream` proxy endpoint in `server.ts`.
  - *Why*: Inherits the zero-key client architecture, automated fallback to `gemini-3.1-flash-lite`, and rate-limit safeguards already established.

---

## 4. Technical Architecture & Component Interaction

```
┌────────────────────────────────────────────────────────┐
│                   WhiteboardTab                        │
│  - Canvas Ref & Strokes State                          │
│  - Toolbar with [ ✨ Ask Beacon ] Trigger              │
└────────────────────────────────────────────────────────┘
          │ (Click Trigger)
          ▼
┌────────────────────────────────────────────────────────┐
│   Canvas Export & Snapshot Engine                      │
│   • Render strokes to offscreen/temp canvas            │
│   • Generate optimized base64 JPEG                     │
└────────────────────────────────────────────────────────┘
          │ (base64 image payload)
          ▼
┌────────────────────────────────────────────────────────┐
│   WhiteboardAISolutionSheet (Bottom Sheet Modal)        │
│   • Streams solution via /api/gemini/stream            │
│   • Renders Markdown + LaTeX ($...$ and $$...$$)       │
│   • Follow-up question chat input                      │
└────────────────────────────────────────────────────────┘
```

- **Prompt / System Instruction for Whiteboard Vision**:
  - Instructs Beacon AI: *"You are Beacon AI on Stardesk Whiteboard. The user has drawn or written a problem, question, or diagram on their canvas. 1. Identify and transcribe the problem clearly. 2. Provide a step-by-step solution with clear reasoning and final answer. 3. Format all math using standard LaTeX ($...$ and $$...$$)."*
- **Empty Canvas Detection**:
  - If the student taps the button with 0 strokes drawn, an unobtrusive toast/prompt informs them: *"Draw or write a problem on the whiteboard first!"*
