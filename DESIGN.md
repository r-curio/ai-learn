---
name: ai-learn
description: A quiet place to work through a topic with a tutor who checks what you understand.
colors:
  background: "#F6F6F9"
  background-dark: "#1F2030"
  foreground: "#23243A"
  foreground-dark: "#E6E7F5"
  card: "#FFFFFF"
  card-dark: "#2A2B40"
  popover: "#FFFFFF"
  popover-dark: "#191A28"
  primary: "#5B5FC7"
  primary-dark: "#C9CCF5"
  primary-foreground: "#FFFFFF"
  primary-foreground-dark: "#1F2030"
  secondary: "#E4E4EC"
  secondary-dark: "#14151F"
  muted: "#ECECF2"
  muted-dark: "#35375A"
  muted-foreground: "#5E6078"
  muted-foreground-dark: "#A3A5C0"
  accent: "#E6E7F7"
  accent-dark: "#35375A"
  border: "#DEDEEA"
  border-dark: "#3A3C58"
  sidebar: "#F0F0F5"
  sidebar-dark: "#1C1D2C"
  rail: "#ECECF2"
  rail-dark: "#191A28"
  warning: "#9A6400"
  warning-dark: "#F2B84B"
  destructive: "#C9372C"
  destructive-dark: "#F2786D"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 500
    lineHeight: "40px"
    letterSpacing: "-0.02em"
  question:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: "25px"
  brand:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "20px"
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "24px"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "18px"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "18px"
  caption:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "16px"
  micro:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
rounded:
  xs: "5px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  2xl: "16px"
  3xl: "20px"
  full: "9999px"
spacing:
  0.5: "2px"
  1: "4px"
  1.5: "6px"
  2: "8px"
  2.5: "10px"
  3: "12px"
  3.5: "14px"
  4: "16px"
  5: "20px"
  6: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.title}"
    rounded: "{rounded.lg}"
    height: "40px"
    padding: "0 14px"
  button-outline:
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    height: "38px"
    padding: "0 10px"
  button-send:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.full}"
    size: "32px"
  button-new-chat-active:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 10px"
  rail-item-active:
    backgroundColor: "{colors.card}"
    textColor: "{colors.primary}"
    rounded: "{rounded.lg}"
    size: "36px"
  chat-row-active:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 10px"
  input-search:
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "34px"
    padding: "0 10px"
  tabs-list:
    backgroundColor: "{colors.secondary}"
    rounded: "{rounded.md}"
    height: "32px"
    padding: "3px"
  tabs-trigger-active:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
  composer:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.3xl}"
    width: "680px"
    padding: "14px 12px 12px 18px"
  learner-message:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.2xl}"
    padding: "10px 16px"
  answer-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.question}"
    rounded: "{rounded.3xl}"
    width: "680px"
    padding: "14px"
  answer-choice-selected:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    height: "38px"
    padding: "0 10px"
  popover:
    backgroundColor: "{colors.popover}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    width: "270px"
    padding: "12px 14px"
---

# Design System: ai-learn

Values come from the [M1 · Chosen design](https://app.paper.design/file/01M6K667H87BCQPSD9R4ZWSTST/p-4-0) frames in Paper. If this file and a frame disagree, the frame wins and this file gets corrected. The code still has the older green theme until issue #16 moves it to these tokens.

## Overview

**Creative North Star: "The Quiet Study"**

ai-learn is a calm room built for thinking. Cool indigo-grey surfaces sit close together in tone, so the shell recedes and the words of the conversation carry the screen. Text is plain and set for reading, and nothing competes with it.

The interface earns attention only when the tutor needs something from the learner. Indigo marks where the learner is and what they can do next. When the tutor asks a question, the answer card takes the composer's place and becomes the largest object on the screen.

Light and dark are equal themes, drawn frame for frame, and the dark theme is a deep indigo night rather than an inverted light theme. Density is calm but practical: small controls, generous space around the conversation.

**Key Characteristics:**

- One indigo accent on layered cool neutrals
- Surfaces separated by tone, with few lines and almost no shadow
- Inter at a few steady sizes, with medium weight for emphasis
- Soft corners that grow with the size of the object
- Every control is a shadcn component styled with Tailwind
- Fluid, damped motion that answers every interaction and never overshoots

## Colors

A cool, indigo-tinted neutral family with one indigo accent. Amber and red appear only as warnings. Token names follow shadcn, and each has a `-dark` value in the frontmatter.

### Primary

- **Study Indigo** (`primary`): the current rail item, the Send and Submit buttons, the selected answer's letter, the slider, the normal context ring, and links. In dark it becomes a pale periwinkle, with dark text on top.

### Neutral

- **Paper Mist** (`background`): the main chat surface.
- **Ink Indigo** (`foreground`): titles, replies, and anything the learner is reading.
- **Slate Violet** (`muted-foreground`): placeholders, inactive chat titles, usage, captions, and icons.
- **Clean Sheet** (`card`): the raised surface for the composer, answer card, New chat when active, the active chat row, the active rail item, and the active tab.
- **Rail Shade** (`rail`) and **Sidebar Shade** (`sidebar`): the two steps that separate the shell from the chat. The rail is darkest in dark mode and the sidebar sits between it and the chat.
- **Track Grey** (`secondary`): the track behind segmented controls.
- **Quiet Chip** (`muted`): letter chips on unselected answers.
- **Lavender Wash** (`accent`): learner messages and the selected answer.
- **Hairline** (`border`): outlines on inputs, cards, choices, and popovers, plus the empty part of the slider and context ring.
- **Deep Popover** (`popover`): floating panels. It's white in light, and darker than the chat in dark.

### Status

- **Lamp Amber** (`warning`): the context ring and label from 80% full.
- **Signal Red** (`destructive`): the context ring and label from 95% full, and failed replies.

### Named Rules

**The One Accent Rule.** Indigo is the only accent. It marks the current place or the next action, never decoration.

**The Earned Alarm Rule.** Amber and red appear only when something needs the learner's attention, and always with words, never colour alone.

**The Token Rule.** Colours come only from `src/web/globals.css`, and Tailwind's default palette stays off. Add a new token here and in the frames first. shadcn's `sidebar-*` tokens map onto these: `sidebar` to Sidebar Shade, `sidebar-accent` to Clean Sheet, and the rest to their matching tokens.

## Typography

**Body Font:** Inter (with system-ui, sans-serif), bundled with the app at a pinned version.

**Character:** One neutral typeface on every system, so the app reads the same on macOS, Windows, and Linux. Hierarchy comes from size and medium weight, not from a second family.

### Hierarchy

- **Display** (500, 32px/40px, -0.02em): the new chat and setup headings, only.
- **Question** (500, 17px/25px): the tutor's question in the answer card.
- **Brand** (600, 16px/20px, -0.02em): the "ai-learn" name beside the logo.
- **Body** (400, 15px/24px): replies and learner messages, which use a 23px line height in the bubble. Keep the composer text at this size too.
- **Title** (500, 14px/18px): chat title, active chat row, New chat, Submit answer, and popover headings.
- **Label** (400, 14px/18px): inactive chat rows, answer choices, and the search field.
- **Caption** (400, 13px/16px): context, model and effort, segmented options, and notices, with 500 for emphasis.
- **Micro** (400, 12px/16px): usage in the top bar and slider end labels. This is the smallest size.

### Named Rules

**The Two Weights Rule.** Use 400 for reading and 500 for emphasis. The brand name is the only 600.

**The Single Display Rule.** The display size appears only on the new chat and setup screens.

## Layout

The window is three columns: a **rail** (56px), a **sidebar** (272px, or 216px with a PDF open), and the **chat**. When the sidebar is collapsed, only the rail stays and the chat re-centres in the remaining space.

The chat has a 52px top bar with 24px side padding, with the title on the left and usage on the right. The conversation and composer share a centred 680px column. Turns sit 20px apart, reply paragraphs 12px apart, and the composer keeps 20px below it. Learner messages align right and reach at most 440px.

The sidebar has 10px side padding, with 14px between its groups and 2px between chat rows.

Spacing follows the frontmatter scale. Only 1280×800 was drawn, so narrow windows are undecided. The window's minimum is 520px wide, which is narrower than the rail, sidebar, and any useful chat combined.

## Elevation & Depth

Flat by default. Depth comes from stepped surface tones: rail, sidebar, chat, then card. A 1px line is added only where a surface needs a clear edge, such as the composer or an input.

### Shadow Vocabulary

- **Light popover** (`shadow-popover`, `0 4px 16px rgb(35 36 58 / 0.1)`): floating panels in light mode only. Dark mode uses the Deep Popover tone and a border instead.

### Named Rules

**The Flat-By-Default Rule.** The only shadow in the system belongs to floating panels. Cards and buttons never have one.

## Shapes

Corners are soft and grow with the object: small keys and chips at 5–6px, controls and rows at 8–10px, floating panels at 12px, learner messages at 16px, and the composer and answer card at 20px. The Send button and slider handle are the only full circles. Nested corners shrink inwards, such as an 8px track holding a 6px tab.

## Components

Quiet and precise: controls sit still until they're needed, then respond clearly.

**Every control is a shadcn component, and every style is a Tailwind class.** Check what's already in `src/web/components/` first, because `npx shadcn add` overwrites our edits to anything that exists.

| M1 element                       | shadcn component                 |
| -------------------------------- | -------------------------------- |
| Rail, sidebar, and chat rows     | `sidebar`, cut down per ADR 0008 |
| Buttons, Send, Stop, and Retry   | `button`                         |
| Search and reasoning fields      | `input`, `textarea`              |
| All/Learning/Practice            | `tabs`                           |
| Model picker                     | `popover` with `command`         |
| Model price                      | `tooltip`                        |
| Effort menu                      | `popover` with Radix `Slider`    |
| Context details                  | `popover`                        |
| Answer choices                   | `radio-group` with `item`        |
| How sure are you?                | `slider`                         |
| Space key hint                   | `kbd`                            |
| Reply and app notices            | `alert`, drawn plain             |
| Activity trace and subagent rows | `collapsible`                    |

### Icons

Use `lucide-react` at a pinned version, choosing the closest match to the frame, with a 1.5px stroke. Icons are 20px in the rail and composer, 18px for New chat and collapse, and 16px in small fields. The ai-learn logo is the one custom mark, and its SVG comes from the frame.

### Motion

Every interactive component responds fluidly to the learner's input, then settles. Motion is built into the component in `src/web/components/`, so features get it without adding their own.

| Speed    | Duration | Easing                  | Use                                                                      |
| -------- | -------- | ----------------------- | ------------------------------------------------------------------------ |
| `fast`   | 150ms    | Ease-out                | Colour and hover                                                         |
| `base`   | 200ms    | Strong ease-out         | Reveals: popovers, menus, tab panels, notices, the answer card           |
| `slow`   | 300ms    | Strong ease-out         | Large surfaces: the sidebar collapsing, and the PDF and background panes |
| `spring` | 250ms    | Damped spring, below    | Direct input: press, selection, tab indicator, popup opening             |
| `exit`   | 120ms    | Ease-in, never a spring | Anything leaving                                                         |

Spring settings, written as stiffness/damping/mass:

- **Pop** (620/38/0.6): popups opening from their trigger, with a 120ms fade.
- **Highlight** (700/46/0.5): pressing a button, and sliding tab indicators and selections.
- **Confirm** (520/34/0.45): a check or success icon arriving.

How each component moves:

- **Buttons:** scale to 97% while pressed and spring back. Colour changes at `fast`.
- **Tabs:** the active tab's Clean Sheet background slides to the new tab with Highlight, rather than jumping.
- **Menus and popovers:** open from their trigger with Pop, scaling from 98% and rising 2–4px. They close at `exit`.
- **Sidebar:** collapses and opens at `slow`, and the chat column glides to its new centre with it.
- **Answer choices:** the selected border and tint arrive at `fast`, and the letter chip uses Highlight.
- **Slider:** the handle follows the pointer exactly while dragging, with no transition. Keyboard changes use Highlight.
- **Answer card and composer:** swap at `base` with a fade and a small rise, keeping the top edge steady once the card is open.
- **Context meter:** the ring and its colour move at `base` when the value changes.
- **Replies:** text appears as it streams, with no typing effect or per-word animation.

Use Tailwind transitions and CSS custom properties in `src/web/globals.css` first, with `tw-animate-css` for shadcn's open and close states. Add `motion` at a pinned version only where CSS can't do the job, like measuring a tab indicator's position or swapping elements as they leave.

**The Answers Input Rule.** Motion responds to what the learner just did. Only spinners, skeletons, and the tutor's activity indicator move on their own, because they report that work is under way.

**The No Overshoot Rule.** Springs are critically damped or close to it (damping ratio 0.95 or higher), so nothing bounces.

**The Small Moves Rule.** Animate opacity, colour, and small transforms. Only the sidebar, panes, and collapsible sections may animate size.

**The Reduced Motion Rule.** When the system asks for reduced motion, transforms and scaling turn off, while opacity and colour stay.

### Buttons

- **Shape:** gently curved (10px), or a full circle for Send.
- **Primary:** Study Indigo with its foreground colour. Used for Send and Submit answer.
- **Outline:** a hairline border with Ink Indigo text. Used for Retry, I don't know, and Type my own answer.
- **Disabled:** 45% opacity.
- **Hover / Focus:** hover wasn't drawn, so use the component's `muted` hover. Keep the visible 2px focus outline in `ring`, which uses the primary colour.

### Navigation

- **Rail:** 36px square items with 6px between them. The active item is Clean Sheet with an indigo icon. Home, graphs, and settings stay inert until they have somewhere to go.
- **Sidebar:** logo and name with a collapse button, then New chat, search, filter, and chats. The active row uses Clean Sheet with Title type, and inactive rows use Slate Violet with Label type. New chat is Clean Sheet only while the new chat screen is open.
- **Window controls:** real system controls, never drawn ones. The frames' three dots are placeholders.

### Segmented control

- **Style:** a Track Grey `tabs` list with 3px padding, holding a Clean Sheet active tab. It's 32px with 13px text in the sidebar, and 36px with 14px text on the new chat screen.

### Inputs / Fields

- **Style:** a hairline border and 8–10px corners, with no fill of their own.
- **Focus:** a border shift or the focus outline, kept within the existing `ring` token.

### Composer

- **Style:** a Clean Sheet card with a hairline border and 20px corners, 680px wide, with text above a row of controls.
- **Row:** attach and context on the left; model, effort, mic, and Send on the right.

### Learner message and reply

- **Learner message:** a Lavender Wash bubble with 16px corners, aligned right.
- **Reply:** plain text on the background with no bubble. Markdown stays in `prose.module.css`, the one place Tailwind classes can't reach.

### Answer card

The product's signature component, which replaces the composer while a question is waiting.

- **Structure:** the question, then choices A–D, then I don't know and Type my own answer, the confidence slider, reasoning, and a full-width Submit answer. Model, effort, and context move to a row beneath it.
- **Choices:** 38px rows with a 22px letter chip. Selected rows use Lavender Wash, a 1.5px indigo border, and an indigo chip.
- **Slider:** a 4px track and a 16px handle. Issue #25 covers its unset and "Not needed" states.
- **Steadiness:** the card's top edge doesn't move between states, except when the reasoning text grows.

### Model and Effort menus

Both float over the composer rather than above it, with their bottom edge 6px over the controls row. The [Model picker variants](https://app.paper.design/file/01M6K667H87BCQPSD9R4ZWSTST/p-8-0) page replaces frames 04 and 05.

- **Model picker:** 300px wide, with search, models grouped under their provider, and Add provider at the bottom. Each 36px row has the name, a context badge, and a check slot. The exact price shows in a tooltip on hover or arrow-key focus.
- **Effort slider:** a 40px Track Grey pill holding the five level names. A Clean Sheet knob carries the current name, with an indigo trail running from the left edge through the knob, so Max fills the whole bar. It rests only on named levels, and always shows all five. Levels a model doesn't allow are dimmed and skipped. This is separate from the answer card's 4px confidence slider.

### Context meter

- **Style:** an 18px ring with a 2px stroke and a 13px percentage label. It's indigo normally, amber from 80%, and red from 95%. Its details open in a 270px popover.

### Passage highlight

- **Style:** frame 10 highlights a cited passage in `#FFE600` on a page that stays white in both themes (issues #27 and #28). This is the one colour outside the theme, because it sits on the learner's document.

## Do's and Don'ts

### Do:

- **Do** use a shadcn component for every control, and add one with `npx shadcn add` when it's missing.
- **Do** style with Tailwind classes and tokens from `src/web/globals.css`.
- **Do** build each new screen in both light and dark, checking it against its M1 frame.
- **Do** separate surfaces by tone first, and add a line only where an edge is needed.
- **Do** use the operating system's real window controls on macOS, Windows, and Linux.
- **Do** give every interactive component the fluid response in Motion, built into the component itself.
- **Do** check each animation with the system's reduced motion setting on.
- **Do** read a screen's M1 frame in Paper for exact values, because this file holds the system rather than every state.

### Don't:

- **Don't** hand-build a control that shadcn provides.
- **Don't** add global CSS, per-feature stylesheets, or inline styles. CSS Modules are only for what classes can't reach, like Markdown output.
- **Don't** use Tailwind palette colours like `bg-white`, because they render with no colour and no error.
- **Don't** add a second accent, gradients, or shadows on cards and buttons.
- **Don't** use type smaller than 12px, or a second typeface in the interface. Monospace is only for code, and for key and file names.
- **Don't** signal a warning with colour alone.
- **Don't** draw fake window controls.
- **Don't** use bounces, off-screen slides, staggered list entrances, or idle and scroll-triggered animation.
- **Don't** slow down typing or dragging with a transition on what the learner is directly controlling.
