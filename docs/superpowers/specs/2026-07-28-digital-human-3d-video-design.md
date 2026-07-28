# Digital Human, 3D Exhibition, and Video Center Design

## Goal

Extend the existing digital tourism guide into a desktop-browser experience with two new independent pages:

- A 3D exhibition hall with first-person roaming and a lightweight West Lake scene.
- A video center with server-backed video data, editable danmaku, keyword filtering, subtitles, and an optional live speech-recognition enhancement.

The existing digital-human homepage remains the product entry point. The core version is due on 2026-08-01 and the complete demonstration version is due on 2026-08-05.

## Scope and Delivery Boundary

The 2026-08-05 demonstration version includes:

- Existing text and voice digital-human consultation, including speech output and graceful text-only fallback.
- A desktop-only 3D exhibition hall with mouse-look, `W/A/S/D` movement, room and object collision detection, interactive exhibits, and a lightweight West Lake scene.
- Six legally usable sample videos, Redux Toolkit video-list state, playback, subtitles, danmaku, danmaku preferences, keyword filtering, and persistent danmaku records.
- A Node backend API, SQLite persistence, OpenAPI documentation, focused unit and browser tests, and a run guide.

The following are deliberately out of scope for this delivery:

- Account registration, sign-in, role permissions, and a video-management back office.
- Mobile virtual joystick controls.
- Survey-grade or film-grade West Lake modeling.
- Third-party production content-moderation services.

## Navigation and Homepage

The current digital-human homepage stays visually intact. It is the unified consultation and recommendation experience.

Two direct navigation buttons are added in the upper-right header safe area:

| Entry         | Route         | Behavior                                  |
| ------------- | ------------- | ----------------------------------------- |
| 3D Exhibition | `/exhibition` | Opens the independent 3D exhibition page. |
| Video Center  | `/videos`     | Opens the independent video center page.  |

The buttons must not overlap the digital-human stage, its existing action controls, or the left and right content panels.

Visual interaction rules:

- Idle state uses approximately 14% opacity so the entries blend into the existing low-contrast information layers.
- Hover and keyboard focus use a light mint-green surface, dark green text and icon color, a restrained gold border, and a small shadow.
- Activation navigates immediately. No dropdown, drawer, or expanding panel is used.
- The two buttons remain top-only controls; the existing bottom navigation is not widened or reordered.

The digital-human assistant keeps existing tourism guidance. It additionally recognizes exhibition and video requests, replies with a concise recommendation, and provides direct navigation to the matching page.

## 3D Exhibition Page

### Scene Direction

The primary scene is a contemporary West Lake indoor exhibition hall. Its material palette is stone white, celadon green, and dark wood. The room uses consistent materials across walls, floor, ceiling, and exhibition fixtures.

The room contains wall art, chandeliers, exhibition tables, a bicycle, a car, and a small amount of greenery. Each floor-level obstacle is represented by a collision volume.

### Navigation and Interaction

- Desktop browser only.
- Mouse movement controls camera direction.
- `W`, `A`, `S`, and `D` control movement.
- The camera remains inside the room through room-boundary collision checks.
- The camera cannot pass through decorative objects, tables, bicycles, cars, or exhibit plinths.
- Clicking an exhibit opens a concise image-and-text introduction with an explicit action to view a related video. It does not force navigation.
- A floating, collapsed digital-human entry remains available on this page and opens the existing consultation experience when requested.

### West Lake Scene

The indoor hall contains an interactive West Lake digital-sandbox exhibit. Activating it switches to a separate lightweight West Lake roaming scene with representative water, bridge, trees, and landmark composition. A persistent return control returns the visitor to the indoor hall.

The West Lake scene is intentionally optimized for the demonstration deadline: it is a coherent, roamable low-poly scene rather than an exact geographic reconstruction.

## Video Center Page

### Video List and Playback

- The page displays six backend-provided sample videos with title, cover, duration, and short description.
- Redux Toolkit owns loading, success, failure, and cached video-list state.
- The selected video plays in the primary player; the list remains available for quick switching.
- A collapsed digital-human entry is available without obscuring video controls or danmaku.

### Danmaku

- A danmaku record stores video ID, playback timestamp, sanitized content, generated anonymous nickname, color, position, and creation time.
- Users are anonymous. The server assigns a display name such as `Visitor 1024`.
- Viewer preferences control display speed, font size, opacity, and density. They are saved locally in the browser.
- A submitted danmaku selects its own color and position: scrolling, top, or bottom.
- The video element is the single playback clock. Pausing freezes danmaku and subtitles; resuming restarts both; seeking re-renders records relevant to the new timestamp.
- Video-specific danmaku is queried by timestamp window so replaying the same video at the same position shows the matching records.

### Keyword Filtering

- The backend owns a preset keyword list.
- Every submitted danmaku is validated and sanitized on the backend before storage and response.
- Each keyword match is replaced with `****`.
- No keyword-management UI or third-party moderation service is included in this delivery.

### Speech Text

- Each sample video has a pre-authored subtitle timeline. This is the primary, reliable experience.
- Real-time speech recognition is an optional enhancement. When available, it can add live recognition text.
- Recognition failure, permission denial, unsupported environments, or network issues automatically fall back to the subtitle timeline without interrupting playback.

## Backend and Data

The existing Node backend gains focused video modules without replacing the established digital-human and voice modules.

### Persistence

SQLite is used for video metadata, danmaku, sensitive keywords, and subtitle timeline data. It requires no separately managed database service and preserves records across backend restarts.

### API Surface

The API is documented through the existing OpenAPI documentation route.

| Endpoint                                     | Purpose                                                         |
| -------------------------------------------- | --------------------------------------------------------------- |
| `GET /api/videos`                            | Return the six sample-video records.                            |
| `GET /api/videos/:videoId`                   | Return selected-video metadata.                                 |
| `GET /api/videos/:videoId/danmaku?from=&to=` | Return sanitized danmaku for a playback-time window.            |
| `POST /api/videos/:videoId/danmaku`          | Validate, sanitize, persist, and return one new danmaku record. |
| `GET /api/videos/:videoId/subtitles`         | Return the pre-authored subtitle timeline.                      |

Request validation rejects unknown videos, invalid timestamps, unsupported colors or positions, and content outside the allowed length. The frontend shows a compact inline error and keeps the player usable.

## Quality and Verification

Tests cover:

- Route availability and direct navigation from the homepage.
- Redux Toolkit loading, success, and failure states for video data.
- Backend keyword replacement, validation, timestamp queries, and SQLite persistence.
- Danmaku behavior when playing, pausing, resuming, seeking, and switching videos.
- Subtitle fallback when real-time recognition is unavailable.
- 3D room boundary collision and representative object collision.
- Browser verification of nonblank 3D rendering, desktop layout, top-right entry hover behavior, and no overlap with the existing action controls.

The implementation includes OpenAPI documentation, sample-data attribution, and concise startup instructions.

## Implementation Order

1. Add route shells and the top-right homepage entries without altering existing digital-human actions.
2. Add video data, SQLite persistence, API documentation, and Redux Toolkit state.
3. Deliver video playback, subtitles, danmaku, filtering, and preference controls.
4. Deliver the indoor 3D exhibition hall, controls, collisions, and exhibit interactions.
5. Add the lightweight West Lake scene and digital-sandbox transition.
6. Add real-time recognition as a progressive enhancement, then complete integration and browser tests.

The order ensures that the 2026-08-01 core flow is demonstrable before the West Lake extension and optional recognition enhancement are finalized.
