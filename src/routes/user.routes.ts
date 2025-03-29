import { Router } from "express";

import {
  getUser,
  getUsers,
  updateUser,
  deleteUser,
  userStatistics,
} from "../controllers/user.controllers";

const userRouter = Router();

userRouter.get("/", getUsers);
userRouter.get("/:userId", getUser);
userRouter.get("/statistics/all", userStatistics);
userRouter.put("/:userId", updateUser);
userRouter.delete("/:userId", deleteUser);

export default userRouter;
