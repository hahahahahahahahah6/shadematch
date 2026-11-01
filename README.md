# ShadeMatch — buy the right shade the first time

Shoppers often buy foundation or lipstick online, get the wrong shade, and send it back. ShadeMatch lets a shopper check the shade on their own face before buying.

Upload one selfie and ShadeMatch will:

1. **Analyze skin color** with the YouCam **AI Facial Color Tones Analyzer** (`skin-tone-analysis`).
2. **Recommend shades** — the 3 closest foundations and 3 suitable lipsticks from a small demo catalog.
3. **Show a virtual try-on** of the chosen foundation + lipstick on the shopper's own photo with YouCam **AI Makeup Virtual Try-On** (`makeup-vto`), side by side with the original.
4. **Stay honest** — every recommendation and result carries the label: *"Visual preview, not a color guarantee — lighting affects results."*

All results come from real YouCam API calls. Nothing is mocked in the app.

## Quick start

Requirements: [Node.js](https://nodejs.org) 18.17 or newer. No other dependencies.

```bash
cp .env.example .env      # Windows: copy .env.example .env
# open .env and paste your YouCam API key after YOUCAM_API_KEY=
npm start
```

Open http://localhost:3000, upload a selfie, and follow the steps.

Optional: put a selfie you have the rights to at `samples/sample.jpg` to get a **Use sample photo** button (files in `samples/` are git-ignored).

Get an API key from the YouCam API console (API Key tab). The key is read from the environment / `.env` only. It is never written into the code, and `.env` is in `.gitignore`.

Run the unit tests (color math, catalog, and request flow with a fake HTTP client):

```bash
npm test
```

## How it works

```
Browser                        ShadeMatch server (Node)                 YouCam API
  | selfie (resized ≤1080px) ->  | POST /s2s/v2.0/file  ----------------> | upload URL + file_id
  |                              | PUT photo to upload URL --------------> |
  |                              | POST /task/skin-tone-analysis -------> | task_id
  |                              | GET  /task/skin-tone-analysis/{id} --> | skin_color, lip_color, ...
  | <- skin color, undertone,    | match against demo catalog (CIELAB)    |
  |    shade picks               |                                        |
  | pick foundation + lipstick ->| POST /task/makeup-vto (foundation +    |
  |                              |      lip_color effects) -------------> | task_id
  |                              | GET  /task/makeup-vto/{id} ----------> | result image URL
  | <- before / after            |                                        |
```

- **Skin color** comes straight from YouCam (`results.color.skin_color`).
- **Undertone and depth** are ShadeMatch's own estimates from that color (hue angle and lightness in CIELAB). YouCam's tone analyzer does not return an undertone field, so the app labels this clearly as an estimate.
- **Foundation match**: CIE76 color difference (ΔE) between the measured skin color and each catalog shade, with a small penalty when the undertone family differs.
- **Lipstick picks**: same undertone family first, then neutrals, adjusted for skin depth.

### YouCam API usage and cost

| Step | Endpoint | Units per successful call (per YouCam docs) |
| --- | --- | --- |
| Upload | `POST /s2s/v2.0/file` | — |
| Skin color | `POST /s2s/v2.0/task/skin-tone-analysis` | 20 |
| Try-on | `POST /s2s/v2.0/task/makeup-vto` | 1 |

Failed tasks are not charged, per YouCam's documentation.

### Photo tips

Face the camera, use even light, keep hair down, and crop so the face fills most of the photo. The analyzer expects one person and rejects photos where the face is too small, cut off, or turned.

## Privacy

- ShadeMatch does **not** store photos. The photo stays in memory for the length of the request and is never written to disk or a database.
- To run the analysis, the photo is uploaded to YouCam's API. YouCam keeps uploaded files for a limited time under its own [file retention policy](https://docs.perfectcorp.com/develop/file_retention_period).
- No accounts, no tracking, no analytics.

## Limits (honest notes)

- This is a hackathon demo. The catalog shades are invented and are not real products.
- A try-on is a visual preview, not a color guarantee. Screens, cameras, and lighting change how color looks.
- The undertone estimate is a simple rule on one color sample, not a professional color analysis.

## Project layout

```
server.js          HTTP server and API routes (no dependencies)
lib/youcam.js      YouCam client: upload, start task, poll
lib/color.js       hex -> CIELAB, ΔE, undertone and depth estimate
lib/catalog.js     demo foundation and lipstick catalog + matching
public/            web app (HTML, CSS, JS)
test/              unit tests (node --test)
```

## License

[MIT](LICENSE)
