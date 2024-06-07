import express from "express";
import authenticate from "../common/middleware/authenticate";
import { asyncWrapper } from "../utils";
import { OrderController } from "./orderController";
import { StripeGW } from "../payment/stripe";
const router = express.Router();

const paymentGw = new StripeGW();
const orderController = new OrderController(paymentGw);

router.post("/", authenticate, asyncWrapper(orderController.create));

export default router;
