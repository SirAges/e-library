import { Router } from "express";

import {
  reviewBook,
  getBookReviews,
  updateReview,
  deleteReview,
  reviewStatistics,
} from "../controllers/review.controllers";
import { reviewBookValidation } from "../middlewares/validation.middleware";

const reviewRouter = Router();

reviewRouter.post("/:bookId", reviewBookValidation, reviewBook);
reviewRouter.get("/:bookId/reviews", getBookReviews);
reviewRouter.get("/statistics/all", reviewStatistics);
reviewRouter.put("/:reviewId", updateReview);
reviewRouter.delete("/:reviewId", deleteReview);

export default reviewRouter;
