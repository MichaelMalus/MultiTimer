# MultiTimer

Hierarchical stopwatch timers in the browser. No build step — static files served by GitHub Pages.

- **Start instantly**: one click (or press `N`) starts an unnamed timer; type a name into it any time while it runs.
- **Nesting**: `+ Child` starts a timer under another. Move any timer (running or not) via the *Move…* dropdown or by dragging it onto another timer / the top of a list.
- **Stop**: stops just that timer; shift-click also stops its running children.
- **Completed**: stopped timers live in a collapsed *Completed* section, where they can be renamed, resumed, moved, or deleted. If a running timer's parent is stopped (or vice versa), it's shown at the top of its section with an "under …" note.
- Data is saved in `localStorage` (per browser) and syncs across open tabs.

## Deploy
Settings → Pages → Deploy from branch → select the branch, `/ (root)`.
