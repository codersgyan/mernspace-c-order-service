import express from "express";
import { asyncWrapper } from "../utils";
import { PaymentController } from "./paymentController";
import { StripeGW } from "./stripe";

const router = express.Router();

// todo: move this instanciation to a Factory
const paymentGW = new StripeGW();
const paymentController = new PaymentController(paymentGW);

router.post("/webhook", asyncWrapper(paymentController.handleWebhook));

export default router;
