# Use shadcn's sidebar, cut down to what we use

The sidebar now comes from shadcn/ui rather than being hand-built, which reverses that part of ADR 0007. The owner decided that every control should come from shadcn, and its sidebar already handles collapsing, the narrow-window overlay, and the keyboard shortcut.

The copied file was 702 lines, over the 400-line limit. Instead of splitting it across files, we removed what the app doesn't use: other sides and variants, icon mode, groups, submenus, skeletons, and tooltips. That leaves about 260 lines. The cost is that the file is further from shadcn's, so upstream fixes need merging by hand, and running `shadcn add sidebar` again would undo this work.

## Consequences

If a later screen needs a removed part, like menu groups, copy it back from shadcn's source rather than re-adding the component.

shadcn's version saves its open state in a short-lived cookie. We removed that, and the caller now saves it through the local server, so it lasts between launches.
