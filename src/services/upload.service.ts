import cloudinary from "../config/cloudinary.js";
/**
 * Uploads a base64 file to Cloudinary.
 * @param {string} filePath - The base64 encoded file string.
 * @returns {Promise<object>} - Cloudinary upload response.
 */
export const uploadFile = async (filePath: string) => {
  if (!filePath) {
    throw new Error("please provide a base64 path");
  }
  const isValidFilePath = filePath.startsWith("data:");
  if (!isValidFilePath) {
    throw new Error("invalid file path");
  }
  let options = {
    use_filename: true,
    unique_filename: false,
    overwrite: true,
    invalidate: true,
    timeout: 60000,
    folder: "labook",
  };

  const isImage = filePath.startsWith("data:image");
  const isVideo = filePath.startsWith("data:video");
  const isRaw =
    filePath.startsWith("data:application/msword") ||
    filePath.startsWith(
      "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) ||
    filePath.startsWith("data:application/pdf");

  try {
    const uploadResponse = await cloudinary.uploader.upload(filePath, options);

    return {
      secure_url: uploadResponse.secure_url,
      format: uploadResponse.format,
      size: uploadResponse.bytes,
      public_id: uploadResponse.public_id,
    };
  } catch (error: any) {
    throw new Error(error.message);
  }
};
