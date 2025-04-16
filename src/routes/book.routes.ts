import { Router } from "express";

import {
  createBook,
  getBook,
  getBooks,
  updateBook,
  deleteBook,
  bookStatistics,
  searchBooks,
} from "../controllers/book.controllers";
import { adminAuthorization } from "../middlewares/auth.middleware";
import uploadFile from "../middlewares/upload.middleware";
import { validateBookCreation } from "../middlewares/validation.middleware";
import upload from "../config/multer";

const bookRouter = Router();

bookRouter.post(
  "/",
  upload,
  adminAuthorization,
  validateBookCreation,
  uploadFile,
  createBook
);
bookRouter.get("/", getBooks);
bookRouter.get("/:bookId", getBook);
bookRouter.put("/:bookId",upload, adminAuthorization, uploadFile, updateBook);
bookRouter.delete("/:bookId", adminAuthorization, deleteBook);
bookRouter.get("/statistics/all", adminAuthorization, bookStatistics);
bookRouter.get("/search/all", searchBooks);

export default bookRouter;
