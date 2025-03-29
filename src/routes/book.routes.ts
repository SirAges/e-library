import { Router } from "express";

import {
  createBook,
  getBook,
  getBooks,
  updateBook,
  deleteBook,
  bookStatistics,
} from "../controllers/book.controllers";
import { adminAuthorization } from "../middlewares/auth.middleware";
import uploadFile from "../middlewares/upload.middleware";
import upload from "../config/multer";
import { validateBookCreation } from "../middlewares/validation.middleware";

const bookRouter = Router();

bookRouter.post(
  "/",
  validateBookCreation,
  adminAuthorization,
  upload,
  uploadFile,
  createBook
);
bookRouter.get("/", getBooks);
bookRouter.get("/:bookId", getBook);
bookRouter.put("/:bookId", adminAuthorization, upload, uploadFile, updateBook);
bookRouter.delete("/:bookId", adminAuthorization, deleteBook);
bookRouter.get("/statistics/all", adminAuthorization, bookStatistics);

export default bookRouter;
