import multer from "multer";

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fieldSize: 50 * 1024 * 1024 },
}).fields([
  { name: "coverUrl", maxCount: 1 },
  { name: "ebookUrl", maxCount: 1 },
  { name: "videoUrl", maxCount: 1 },
  { name: "idCardUrl", maxCount: 1 },
]);

export default upload;
