# PRO-127 Scrum Standup design previews

Each direction is intentionally kept on its own branch.

- Direction A — chosen agent matrix: branch `design/pro-127-agent-matrix`, file `direction-a-agent-matrix.html`.
- Direction B — agent spotlight: branch `design/pro-127-agent-spotlight`, file `direction-b-agent-spotlight.html`.

The HTML files load `app/src/styles/{tokens,global,themes-fun,themes-cosy}.css` directly and contain no build-time dependency. Open from a repo checkout or serve the repo root:

```sh
python3 -m http.server 8765
```

Then open the direction file under `/_context/mockups/2026-08-09-scrum-standup/`. Both previews include touch interactions and a fun/cosy theme toggle.
