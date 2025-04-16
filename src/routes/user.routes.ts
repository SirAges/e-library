import { Router } from "express";

import {
  getUser,
  getUsers,
  updateUser,
  deleteUser,
  userStatistics,
  searchUsers,
} from "../controllers/user.controllers";
import { adminAuthorization } from "../middlewares/auth.middleware";

const userRouter = Router();

userRouter.get("/", getUsers);
userRouter.get("/:userId", getUser);
userRouter.get("/statistics/all", adminAuthorization, userStatistics);
userRouter.put("/:userId", updateUser);
userRouter.delete("/:userId", deleteUser);
userRouter.get("/search/all", searchUsers);
export default userRouter;
