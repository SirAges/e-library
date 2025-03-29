import { Router } from "express";

import {
  borrowBook,
  getBorrowedBook,
  getAllBorrowedBooks,
  extendReturnDate,
  deleteBorrowedBook,
  getUserBorrowedBooks,
  getAllBorrowedBookStatistics,
  cancelRequestForBorrowedBook,
  updateBorrowedBookStatus,
} from "../controllers/borrow.controllers";
import {
  adminAndLibrarianAuthorization,
  adminAuthorization,
  librarianAuthorization,
} from "../middlewares/auth.middleware";
import { borrowBookValidation } from "../middlewares/validation.middleware";

const borrowRouter = Router();

borrowRouter.get("/", getAllBorrowedBooks);
borrowRouter.get("/:borrowId", getBorrowedBook);
borrowRouter.get("/user/all", getUserBorrowedBooks);
borrowRouter.get(
  "/statistics/all",
  adminAuthorization,
  getAllBorrowedBookStatistics
);
borrowRouter.post("/", borrowBookValidation, borrowBook);
borrowRouter.put("/:borrowId", extendReturnDate);
borrowRouter.put("/:borrowId/cancel", cancelRequestForBorrowedBook);
borrowRouter.put(
  "/:borrowId/status-update",
  librarianAuthorization,
  updateBorrowedBookStatus
);
borrowRouter.delete(
  "/:borrowId",
  adminAndLibrarianAuthorization,
  deleteBorrowedBook
);

export default borrowRouter;
