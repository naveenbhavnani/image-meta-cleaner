# Image Meta Cleaner - Canva App Review Documentation

## Overview

Image Meta Cleaner is a privacy-focused utility app that helps users remove all embedded metadata from their images before adding them to Canva designs. This protects user privacy by stripping potentially sensitive information like GPS coordinates, camera details, and timestamps.

## How the App Works

### User Workflow

1. **Upload Image**: User uploads an image using the file picker (supports JPEG, PNG, WebP, and TIFF formats)
2. **View Metadata**: The app reads and displays any detected metadata, highlighting privacy-sensitive data with warnings
3. **Clean Metadata**: User clicks "Clean metadata" to strip all metadata from the image
4. **Add to Design**: User drags or clicks the cleaned image to add it to their Canva design

### Technical Implementation

The app uses a canvas-based approach to remove metadata:

1. The original image is loaded into an HTML `<img>` element
2. The image is drawn onto a fresh HTML Canvas (pixel data only)
3. A new image file is exported via `canvas.toBlob()`
4. This process creates a clean image containing only pixel data - no metadata is preserved

### Metadata Removed

| Category | Examples |
|----------|----------|
| EXIF | GPS coordinates, camera make/model, date taken, exposure settings |
| IPTC | Copyright, caption, keywords, creator name |
| XMP | Adobe metadata, editing history, ratings |
| ICC Profile | Color profile information |
| TIFF tags | Software, orientation, resolution units |
| Other | Embedded thumbnails, comments |

### Metadata Displayed to User

Before cleaning, the app shows users what metadata was detected:

- GPS location (latitude/longitude)
- Date/time photo was taken
- Camera manufacturer (make)
- Camera model
- Software used
- Artist/creator name
- Copyright information
- Image dimensions

Privacy-sensitive fields (GPS, camera info, artist, date) are highlighted in red as risks.

## Content Sources

- **No external APIs**: The app does not connect to any external services or platforms
- **No authentication required**: Users do not need to log in or authenticate
- **Client-side processing**: All image processing happens locally in the browser
- **User-provided content only**: Users upload their own images via the file input

## Testing the App

### Basic Test Flow

1. Open the app in the Canva editor
2. Click "Upload files" or drag an image into the upload area
3. Wait for metadata to be read and displayed
4. Review the detected metadata (if any)
5. Click "Clean metadata" button
6. Wait for processing to complete
7. Drag the cleaned image onto the canvas, or click it to add at cursor position
8. Optionally click "Clean another image" to process additional images

### Test Cases

| Test | Expected Result |
|------|-----------------|
| Upload JPEG with GPS data | GPS coordinates displayed with warning |
| Upload JPEG without metadata | "No metadata found" message shown |
| Upload PNG file | Metadata read and cleaning works |
| Clean image with metadata | Success message, metadata stripped |
| Drag cleaned image to canvas | Image added to design |
| Click cleaned image | Image added at cursor/center |
| Click "Clean another image" | App resets to initial state |

### Sample Test Images

To test metadata detection, you can use any photo taken with a smartphone camera (these typically contain GPS, camera model, and date information). Alternatively, online EXIF sample images can be used.

## Supported File Types

- JPEG (.jpg, .jpeg)
- PNG (.png)
- WebP (.webp)
- TIFF (.tiff, .tif)

## Dependencies

- `exifr` - Library for reading EXIF/IPTC/XMP metadata from images
- `@canva/app-ui-kit` - Canva's UI component library
- `@canva/asset` - For uploading cleaned images to Canva
- `@canva/design` - For adding images to the design canvas

## Privacy & Security

- No data is sent to external servers
- All processing is done client-side in the browser
- Original images are not stored or transmitted
- Cleaned images are only uploaded to Canva when the user adds them to their design

## Contact

For any questions during the review process, please contact:

**Email**: bhavnani.naveen@gmail.com
