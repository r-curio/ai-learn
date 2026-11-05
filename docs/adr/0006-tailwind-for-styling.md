# Style the UI with Tailwind

The UI is styled with Tailwind classes in the components, instead of a stylesheet per feature. The chat redesign restyles every screen, so moving first meant paying for the switch once, and classes next to the markup stop unused CSS from piling up as screens change. The cost is long class lists in the markup, and that every component now depends on Tailwind's names and reset, so leaving would mean rewriting the styling of the whole UI.

We follow the Next.js guidance for what goes where: one global stylesheet, Tailwind for most styling, and a CSS Module only where classes can't reach. So far that's the tutor's Markdown replies, whose tags come from a library. Shared components live in `src/web/components/`, and anything used by one feature stays in that feature's folder.

## Consequences

Tailwind's reset strips browser defaults, so anything rendered without classes needs its styles restored, which is why `prose.module.css` starts with `all: revert`. Two classes that set the same property don't apply in the order written, so a component has to set each property once per variant.
