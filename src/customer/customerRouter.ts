import express from "express";
import { asyncWrapper } from "../utils";
import { CustomerController } from "./customerController";
import authenticate from "../common/middleware/authenticate";
const router = express.Router();

const customerController = new CustomerController();

router.get("/", authenticate, asyncWrapper(customerController.getCustomer));

router.patch(
  "/addresses/:id",
  authenticate,
  asyncWrapper(customerController.addAddress),
);
export default router;
