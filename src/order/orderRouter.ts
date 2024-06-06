import express from "express";
import authenticate from "../common/middleware/authenticate";
import { asyncWrapper } from "../utils";
import { OrderController } from "./orderController";
const router = express.Router();

const orderController = new OrderController();

router.post("/", authenticate, asyncWrapper(orderController.create));

export default router;
