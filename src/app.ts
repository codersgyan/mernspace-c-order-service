import express, { Request, Response } from "express";
import config from "config";
import cors from "cors";
import { globalErrorHandler } from "./common/middleware/globalErrorHandler";
import cookieParser from "cookie-parser";
import customerRouter from "./customer/customerRouter";
import couponRouter from "./coupon/couponRouter";
import orderRouter from "./order/orderRouter";
import paymentRouter from "./payment/paymentRouter";

const app = express();

const ALLOWED_DOMAINS = [
  config.get("frontend.clientUI"),
  config.get("frontend.adminUI"),
];

app.use(cors({ origin: ALLOWED_DOMAINS as string[], credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.json({ message: "Hello from order service service!" });
});

app.use("/customer", customerRouter);
app.use("/coupons", couponRouter);
app.use("/orders", orderRouter);
app.use("/payments", paymentRouter);
app.use(globalErrorHandler);

export default app;
