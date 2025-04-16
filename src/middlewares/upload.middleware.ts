import { Request as ExpressRequest, Response, NextFunction } from "express";
import cloudinary from "../config/cloudinary";
import { ErrorName } from "../lib/enums";

interface Request extends ExpressRequest {
  uploadedFiles?: Record<string, CloudinaryFile>;
}

const uploadFile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (
      (!req.files || Object.keys(req.files).length === 0) &&
      req.method === "PUT"
    ) {
      next();
      return;
    } else if (!req.files || Object.keys(req.files).length === 0) {
      const error = new Error();
      error.name = ErrorName.FileUploadError;
      throw error;
    }

    req.uploadedFiles = {};

    const fileFields = Object.entries(req.files!) as [
      string,
      Express.Multer.File[]
    ][];

    const uploadPromises = fileFields.map(async ([fieldName, files]) => {
      const file = files[0];
      const fileMimeType = file.mimetype;

      const base64File = `data:${fileMimeType};base64,${file.buffer.toString(
        "base64"
      )}`;

      const resourceType = fileMimeType.startsWith("image/")
        ? "image"
        : fileMimeType.startsWith("video/")
        ? "video"
        : "raw";

      const options = {
        folder: "labook",
        resource_type: resourceType as "image" | "video" | "raw",
        use_filename: true,
        unique_filename: false,
        overwrite: true,
        invalidate: true,
        timeout: 60000,
      };

      const result = await cloudinary.uploader.upload(base64File, options);
      req.uploadedFiles![fieldName] = {
        secure_url: result.secure_url,
        format: result.format,
        bytes: result.bytes,
        public_id: result.public_id,
      };
    });

    await Promise.all(uploadPromises);

    next();
  } catch (error) {
    next(error);
  }
};

export default uploadFile;
