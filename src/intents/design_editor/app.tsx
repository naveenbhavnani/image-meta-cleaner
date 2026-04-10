import {
  Box,
  Button,
  FileInput,
  FormField,
  Rows,
  Text,
  Title,
  Alert,
  LoadingIndicator,
  ImageCard,
} from "@canva/app-ui-kit";
import { useFeatureSupport } from "@canva/app-hooks";
import { upload } from "@canva/asset";
import type { ImageDragConfig } from "@canva/design";
import { addElementAtCursor, addElementAtPoint, ui } from "@canva/design";
import { useState, useCallback } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import exifr from "exifr";
import * as styles from "styles/components.css";

interface MetadataInfo {
  // GPS
  latitude?: number;
  longitude?: number;
  // Date/Time
  dateTime?: string;
  dateTimeOriginal?: string;
  // Camera
  make?: string;
  model?: string;
  software?: string;
  // Image
  imageWidth?: number;
  imageHeight?: number;
  orientation?: number;
  // Other
  artist?: string;
  copyright?: string;
  // Raw data for display
  raw?: Record<string, unknown>;
}

type ProcessingState = "idle" | "reading" | "cleaning" | "done";

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
]);

export const App = () => {
  const intl = useIntl();
  const isSupported = useFeatureSupport();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<MetadataInfo | null>(null);
  const [processingState, setProcessingState] =
    useState<ProcessingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [cleanedImageUrl, setCleanedImageUrl] = useState<string | null>(null);
  const [cleanedImageSize, setCleanedImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [isSuccessAlertDismissed, setIsSuccessAlertDismissed] = useState(false);
  const [isNoMetadataAlertDismissed, setIsNoMetadataAlertDismissed] =
    useState(false);

  const hasPrivacyRisks =
    metadata &&
    (metadata.latitude !== undefined ||
      metadata.longitude !== undefined ||
      metadata.make !== undefined ||
      metadata.model !== undefined ||
      metadata.artist !== undefined ||
      metadata.dateTimeOriginal !== undefined);

  const handleFileSelect = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    // Reset state
    setError(null);
    setCleanedImageUrl(null);
    setMetadata(null);
    setSelectedFile(null);
    setImagePreview(null);
    setProcessingState("idle");

    // Validate file type — reject entirely, no point proceeding
    if (!ACCEPTED_MIME_TYPES.has(file.type)) {
      setError(
        intl.formatMessage({
          defaultMessage:
            "Unsupported file format. Please upload a JPEG, PNG, WebP, or TIFF image.",
          description: "Error message for unsupported file format",
        })
      );
      return;
    }

    // Validate file size — set error but still load metadata so user can inspect it
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(
        intl.formatMessage(
          {
            defaultMessage:
              "This image is too large to process ({fileSizeMB} MB). The maximum supported size is {maxSizeMB} MB. Please use a smaller image.",
            description: "Error message for file exceeding size limit",
          },
          {
            fileSizeMB: (file.size / 1024 / 1024).toFixed(1),
            maxSizeMB: MAX_FILE_SIZE_MB,
          }
        )
      );
    }

    setSelectedFile(file);
    setProcessingState("reading");

    // Create preview
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    try {
      // Read metadata using exifr
      const exifData = await exifr.parse(file, {
        gps: true,
        exif: true,
        iptc: true,
        xmp: true,
        icc: false,
        tiff: true,
      });

      if (exifData) {
        const parsedMetadata: MetadataInfo = {
          // GPS
          latitude: exifData.latitude,
          longitude: exifData.longitude,
          // Date/Time
          dateTime: exifData.DateTime?.toString(),
          dateTimeOriginal: exifData.DateTimeOriginal?.toString(),
          // Camera
          make: exifData.Make,
          model: exifData.Model,
          software: exifData.Software,
          // Image
          imageWidth: exifData.ImageWidth || exifData.ExifImageWidth,
          imageHeight: exifData.ImageHeight || exifData.ExifImageHeight,
          orientation: exifData.Orientation,
          // Other
          artist: exifData.Artist,
          copyright: exifData.Copyright,
          // Raw
          raw: exifData,
        };
        setMetadata(parsedMetadata);
      } else {
        setMetadata({});
      }
    } catch {
      setMetadata({});
    }

    setProcessingState("idle");
  }, []);

  const handleCleanMetadata = useCallback(async () => {
    if (!selectedFile) return;

    setProcessingState("cleaning");
    setError(null);

    try {
      // Create a canvas to re-encode the image (strips metadata)
      const img = new Image();
      const loadPromise = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () =>
          reject(
            new Error(
              intl.formatMessage({
                defaultMessage: "Failed to load image",
                description: "Error message when image fails to load",
              })
            )
          );
      });

      img.src = URL.createObjectURL(selectedFile);
      await loadPromise;

      // Create canvas and draw image
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error(
          intl.formatMessage({
            defaultMessage: "Failed to get canvas context",
            description: "Error message when canvas context fails",
          })
        );
      }

      ctx.drawImage(img, 0, 0);

      // Convert to blob (this strips all metadata)
      const cleanedBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(
                new Error(
                  intl.formatMessage({
                    defaultMessage: "Failed to create cleaned image",
                    description: "Error message when image cleaning fails",
                  })
                )
              );
            }
          },
          selectedFile.type === "image/png" ? "image/png" : "image/jpeg",
          0.95
        );
      });

      // Convert blob to data URL for upload and draggable preview
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result);
          } else {
            reject(
              new Error(
                intl.formatMessage({
                  defaultMessage: "Failed to read image data",
                  description: "Error when converting image fails",
                })
              )
            );
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(cleanedBlob);
      });

      // Store the cleaned image data URL and dimensions
      setCleanedImageUrl(dataUrl);
      setCleanedImageSize({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
      setProcessingState("done");
    } catch {
      setError(
        intl.formatMessage({
          defaultMessage: "Failed to clean metadata. Please try again.",
          description: "Generic error message for cleaning failure",
        })
      );
      setProcessingState("idle");
    }
  }, [selectedFile, intl]);

  // Determine which addElement method is supported
  const addElement = [addElementAtPoint, addElementAtCursor].find((fn) =>
    isSupported(fn)
  );

  // Handle click to add image (accessibility fallback and for design types that don't support drag)
  const handleClick = useCallback(async () => {
    if (!cleanedImageUrl || !selectedFile || !addElement || !cleanedImageSize)
      return;

    const mimeType =
      selectedFile.type === "image/png" ? "image/png" : "image/jpeg";

    try {
      const asset = await upload({
        type: "image",
        mimeType,
        url: cleanedImageUrl,
        thumbnailUrl: cleanedImageUrl,
        aiDisclosure: "none",
        width: cleanedImageSize.width,
        height: cleanedImageSize.height,
      });

      await addElement({
        type: "image",
        ref: asset.ref,
        altText: {
          text: intl.formatMessage({
            defaultMessage: "Image with metadata removed",
            description: "Alt text for cleaned image",
          }),
          decorative: false,
        },
      });
    } catch {
      setError(
        intl.formatMessage({
          defaultMessage:
            "Failed to add image to design. Please try again.",
          description: "Error message when adding image fails",
        })
      );
    }
  }, [cleanedImageUrl, selectedFile, addElement, cleanedImageSize, intl]);

  const handleDragStart = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (!cleanedImageUrl || !selectedFile || !cleanedImageSize) return;

      const mimeType =
        selectedFile.type === "image/png" ? "image/png" : "image/jpeg";

      // Create an upload function that will be called when the drag ends
      const uploadCleanedImage = async () => {
        const asset = await upload({
          type: "image",
          mimeType,
          url: cleanedImageUrl,
          thumbnailUrl: cleanedImageUrl,
          aiDisclosure: "none",
          width: cleanedImageSize.width,
          height: cleanedImageSize.height,
        });
        // Return object with ref property as required by the API
        return { ref: asset.ref };
      };

      const dragData: ImageDragConfig = {
        type: "image",
        resolveImageRef: uploadCleanedImage,
        previewUrl: cleanedImageUrl,
        previewSize: {
          width: 100,
          height: 100,
        },
        fullSize: {
          width: cleanedImageSize.width,
          height: cleanedImageSize.height,
        },
      };

      // Use feature detection to support different Canva Editor contexts
      // startDragToPoint: for fixed designs (presentations, social media, etc.)
      // startDragToCursor: for responsive documents (Canva Docs)
      if (isSupported(ui.startDragToPoint)) {
        ui.startDragToPoint(event, dragData);
      } else if (isSupported(ui.startDragToCursor)) {
        ui.startDragToCursor(event, dragData);
      }
    },
    [cleanedImageUrl, selectedFile, cleanedImageSize, isSupported]
  );

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setImagePreview(null);
    setMetadata(null);
    setCleanedImageUrl(null);
    setCleanedImageSize(null);
    setProcessingState("idle");
    setError(null);
    setIsSuccessAlertDismissed(false);
    setIsNoMetadataAlertDismissed(false);
  }, []);

  const formatGPS = (lat?: number, lng?: number) => {
    if (lat === undefined || lng === undefined) return null;
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  const formatFileSize = (bytes: number) => {
    return (bytes / 1024).toFixed(1);
  };

  return (
    <div className={styles.scrollContainer}>
      <Rows spacing="2u">
        {error && <Alert tone="critical">{error}</Alert>}

        {!selectedFile ? (
          <FormField
            label={intl.formatMessage({
              defaultMessage: "Select an image",
              description: "Label for file input",
            })}
            description={intl.formatMessage(
              {
                defaultMessage:
                  "Remove hidden metadata (GPS, camera info, date) from your images for privacy protection. Accepted formats: JPEG, PNG, WebP, TIFF. Maximum file size: {maxSizeMB} MB.",
                description:
                  "App description with accepted formats and size limit",
              },
              { maxSizeMB: MAX_FILE_SIZE_MB }
            )}
            control={(props) => (
              <FileInput
                {...props}
                accept={["image/jpeg", "image/png", "image/webp", "image/tiff"]}
                onDropAcceptedFiles={handleFileSelect}
                stretchButton
              />
            )}
          />
        ) : (
          <Rows spacing="2u">
            {/* Image Preview */}
            {imagePreview && !error && (
              <Box background="neutralLow" borderRadius="standard" padding="1u">
                {/* eslint-disable-next-line react/forbid-elements */}
                <img
                  src={imagePreview}
                  alt={intl.formatMessage({
                    defaultMessage: "Preview",
                    description: "Alt text for image preview",
                  })}
                  style={{
                    width: "100%",
                    maxHeight: "150px",
                    objectFit: "contain",
                    borderRadius: "4px",
                  }}
                />
              </Box>
            )}

            {/* File Info */}
            <Text size="small" tone="secondary">
              <FormattedMessage
                defaultMessage="{fileName} ({fileSize} KB)"
                description="File name and size display"
                values={{
                  fileName: selectedFile.name,
                  fileSize: formatFileSize(selectedFile.size),
                }}
              />
            </Text>

            {/* Loading State */}
            {processingState === "reading" && (
              <Box padding="2u">
                <Rows spacing="1u" align="center">
                  <LoadingIndicator size="medium" />
                  <Text size="small" tone="tertiary">
                    <FormattedMessage
                      defaultMessage="Reading metadata..."
                      description="Loading text while reading metadata"
                    />
                  </Text>
                </Rows>
              </Box>
            )}

            {/* Metadata Display */}
            {metadata && processingState !== "reading" && (
              <Rows spacing="1u">
                <Title size="xsmall">
                  <FormattedMessage
                    defaultMessage="Detected metadata"
                    description="Section title for metadata"
                  />
                </Title>

                {hasPrivacyRisks && (
                  <Alert tone="warn">
                    <FormattedMessage
                      defaultMessage="Privacy risks detected! This image contains personal data."
                      description="Warning about privacy risks"
                    />
                  </Alert>
                )}

                {Object.keys(metadata).length === 0 ||
                (Object.keys(metadata).length === 1 && metadata.raw) ? (
                  !isNoMetadataAlertDismissed && (
                    <Alert
                      tone="info"
                      onDismiss={() => setIsNoMetadataAlertDismissed(true)}
                    >
                      <FormattedMessage
                        defaultMessage="No metadata found in this image."
                        description="Message when no metadata is found"
                      />
                    </Alert>
                  )
                ) : (
                  <Box
                    background="neutralLow"
                    borderRadius="standard"
                    padding="1.5u"
                  >
                    <Rows spacing="0.5u">
                      {formatGPS(metadata.latitude, metadata.longitude) && (
                        <MetadataRow
                          label={intl.formatMessage({
                            defaultMessage: "GPS location",
                            description: "Label for GPS coordinates",
                          })}
                          value={
                            formatGPS(metadata.latitude, metadata.longitude) ||
                            ""
                          }
                        />
                      )}
                      {metadata.dateTimeOriginal && (
                        <MetadataRow
                          label={intl.formatMessage({
                            defaultMessage: "Date taken",
                            description: "Label for date taken",
                          })}
                          value={metadata.dateTimeOriginal}
                        />
                      )}
                      {metadata.make && (
                        <MetadataRow
                          label={intl.formatMessage({
                            defaultMessage: "Camera make",
                            description: "Label for camera manufacturer",
                          })}
                          value={metadata.make}
                        />
                      )}
                      {metadata.model && (
                        <MetadataRow
                          label={intl.formatMessage({
                            defaultMessage: "Camera model",
                            description: "Label for camera model",
                          })}
                          value={metadata.model}
                        />
                      )}
                      {metadata.software && (
                        <MetadataRow
                          label={intl.formatMessage({
                            defaultMessage: "Software",
                            description: "Label for software used",
                          })}
                          value={metadata.software}
                        />
                      )}
                      {metadata.artist && (
                        <MetadataRow
                          label={intl.formatMessage({
                            defaultMessage: "Artist",
                            description: "Label for artist/creator",
                          })}
                          value={metadata.artist}
                        />
                      )}
                      {metadata.copyright && (
                        <MetadataRow
                          label={intl.formatMessage({
                            defaultMessage: "Copyright",
                            description: "Label for copyright info",
                          })}
                          value={metadata.copyright}
                        />
                      )}
                      {metadata.imageWidth && metadata.imageHeight && (
                        <MetadataRow
                          label={intl.formatMessage({
                            defaultMessage: "Dimensions",
                            description: "Label for image dimensions",
                          })}
                          value={`${metadata.imageWidth} x ${metadata.imageHeight}`}
                        />
                      )}
                    </Rows>
                  </Box>
                )}
              </Rows>
            )}

            {/* Action Buttons */}
            {processingState === "cleaning" ? (
              <Box padding="2u">
                <Rows spacing="1u" align="center">
                  <LoadingIndicator size="medium" />
                  <Text size="small" tone="tertiary">
                    <FormattedMessage
                      defaultMessage="Cleaning metadata..."
                      description="Loading text while cleaning"
                    />
                  </Text>
                </Rows>
              </Box>
            ) : processingState === "done" ? (
              <Rows spacing="2u">
                <Rows spacing="1u">
                  {!isSuccessAlertDismissed && (
                    <Alert
                      tone="positive"
                      onDismiss={() => setIsSuccessAlertDismissed(true)}
                    >
                      <FormattedMessage
                        defaultMessage="Metadata removed successfully!"
                        description="Success message after cleaning"
                      />
                    </Alert>
                  )}
                  <Title size="small">
                    <FormattedMessage
                      defaultMessage="Cleaned image"
                      description="Header for cleaned image section"
                    />
                  </Title>
                  {cleanedImageUrl && (
                    <Box>
                      <ImageCard
                        ariaLabel={intl.formatMessage({
                          defaultMessage:
                            "Cleaned image - click or drag to add to your design",
                          description: "Aria label for draggable cleaned image",
                        })}
                        thumbnailUrl={cleanedImageUrl}
                        onClick={handleClick}
                        onDragStart={handleDragStart}
                        borderRadius="standard"
                        alt={intl.formatMessage({
                          defaultMessage: "Image with metadata removed",
                          description: "Alt text for cleaned image preview",
                        })}
                      />
                    </Box>
                  )}
                </Rows>
                <Button variant="primary" onClick={handleClick} stretch>
                  {intl.formatMessage({
                    defaultMessage: "Add to design",
                    description: "Button to add cleaned image to design",
                  })}
                </Button>
                <Button variant="secondary" onClick={handleReset} stretch>
                  {intl.formatMessage({
                    defaultMessage: "Clean another image",
                    description: "Button to start over",
                  })}
                </Button>
              </Rows>
            ) : (
              <Rows spacing="1u">
                <Button
                  variant="primary"
                  onClick={handleCleanMetadata}
                  disabled={!!error || !metadata || processingState === "reading"}
                  stretch
                >
                  {intl.formatMessage({
                    defaultMessage: "Clean metadata",
                    description: "Button to clean metadata",
                  })}
                </Button>
                <Button variant="secondary" onClick={handleReset} stretch>
                  {intl.formatMessage({
                    defaultMessage: "Choose different image",
                    description: "Button to select different image",
                  })}
                </Button>
              </Rows>
            )}
          </Rows>
        )}
      </Rows>
    </div>
  );
};

// Helper component for metadata rows - stacked layout for better localization support
const MetadataRow = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <Rows spacing="0u">
    <Text size="small" variant="bold">
      {label}
    </Text>
    <Text size="small">{value}</Text>
  </Rows>
);
