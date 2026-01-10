# Video Guides Structure

This folder contains video guides for automation workflows.

## Folder Structure

```
videos/
├── honor/
│   ├── google-play/         # Honor Google Play setup videos
│   │   ├── step-1-enable-gms.mp4
│   │   ├── step-2-download-playstore.mp4
│   │   └── step-3-verify.mp4
│   └── cleanup/              # Honor cleanup videos
│       ├── step-1-remove-bloatware.mp4
│       ├── step-2-enable-unknown-sources.mp4
│       └── ...
├── oppo/
│   └── cleanup/              # Oppo cleanup videos
│       └── ...
├── realme/
│   └── cleanup/              # Realme cleanup videos
│       └── ...
├── xiaomi/
│   └── cleanup/              # Xiaomi cleanup videos
│       └── ...
├── shared/
│   └── gaming/               # Gaming optimization (works for all brands)
│       └── ...
└── thumbnails/               # Video poster/thumbnail images
    └── ...
```

## Video Guidelines

### Recording
- **Orientation**: Vertical (Portrait) - 9:16 ratio optimized for phone recordings
- **Resolution**: Minimum 720x1280 (HD), Recommended 1080x1920 (Full HD)
- **Format**: MP4 with H.264 codec for best compatibility
- **Audio**: Optional - clear voiceover in Vietnamese

### Naming Convention
- `step-{number}-{action}.mp4`
- Example: `step-1-enable-gms.mp4`, `step-2-download-playstore.mp4`

### Thumbnails
- Same name as video but with `.jpg` or `.png` extension
- Place in `thumbnails/` folder
- Example: `thumbnails/honor-google-play-step-1.jpg`

## URL Format

Videos are served from `/videos/` path:
- `/videos/honor/google-play/step-1-enable-gms.mp4`
- `/videos/thumbnails/honor-google-play-step-1.jpg`

For local development, place files in this folder.
For production, consider using CDN or cloud storage (Cloudflare R2, AWS S3).
