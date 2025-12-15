declare module "*.css" {
  const styles: { [className: string]: string };
  export = styles;
}

declare module "*.jpg" {
  const content: string;
  export default content;
}

declare module "*.jpeg" {
  const content: string;
  export default content;
}

declare module "*.png" {
  const content: string;
  export default content;
}

declare module "*.svg" {
  const content: React.FunctionComponent<{
    size?: "tiny" | "small" | "medium" | "large";
    className?: string;
  }>;
  export default content;
}

declare const BACKEND_HOST: string;

declare module "exifr" {
  interface ParseOptions {
    gps?: boolean;
    exif?: boolean;
    iptc?: boolean;
    xmp?: boolean;
    icc?: boolean;
    tiff?: boolean;
  }

  interface ExifData {
    latitude?: number;
    longitude?: number;
    DateTime?: Date | string;
    DateTimeOriginal?: Date | string;
    Make?: string;
    Model?: string;
    Software?: string;
    ImageWidth?: number;
    ImageHeight?: number;
    ExifImageWidth?: number;
    ExifImageHeight?: number;
    Orientation?: number;
    Artist?: string;
    Copyright?: string;
    [key: string]: unknown;
  }

  function parse(input: File | Blob | ArrayBuffer | string, options?: ParseOptions): Promise<ExifData | null>;

  export default { parse };
  export { parse };
}
