# Build the UI on shadcn/ui primitives

Shared UI controls come from shadcn/ui rather than being written by hand. The chat redesign needs controls like a slider and search, where keyboard and screen-reader behaviour is tedious to get right. shadcn fits because it copies component source into `src/web/components/`, so we can edit it to match the design, and it's built on Tailwind, which ADR 0006 already chose. Behaviour comes from Radix through the `radix-ui` package. The cost is that we own the copied code, so upstream fixes don't arrive on their own.

We took shadcn's colour names instead of aliasing them to ours. An alias couldn't work: shadcn's `accent` and `muted` are pale backgrounds, while ours were the brand green and grey text, so its hover states would have turned solid green.

## Consequences

The copied files are edited to match the design, so running `shadcn add` over an existing file would undo those edits. Our edits include defaulting `Button` to `type="button"`, because shadcn's would submit any form it sits in.

The palette stays locked, so a new component that uses a Tailwind colour like `bg-white` renders with no colour and no error. Check each added component for those and swap in a token.

Class conflicts are now resolved by `cn`, which replaces the rule in ADR 0006 that a component sets each property once per variant.

shadcn's `sidebar` is 709 lines, over the 400-line limit, so the sidebar shell stays hand-built.
