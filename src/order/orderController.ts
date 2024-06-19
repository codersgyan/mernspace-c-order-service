import { NextFunction, Request, Response } from "express";
import { Request as AuthRequest } from "express-jwt";
import {
  CartItem,
  ProductPricingCache,
  ROLES,
  Topping,
  ToppingPriceCache,
} from "../types";
import productCacheModel from "../productCache/productCacheModel";
import toppingCacheModel from "../toppingCache/toppingCacheModel";
import couponModel from "../coupon/couponModel";
import orderModel from "./orderModel";
import {
  OrderEvents,
  OrderStatus,
  PaymentMode,
  PaymentStatus,
} from "./orderTypes";
import idempotencyModel from "../idempotency/idempotencyModel";
import mongoose from "mongoose";
import createHttpError from "http-errors";
import { PaymentGW } from "../payment/paymentTypes";
import { MessageBroker } from "../types/broker";
import customerModel from "../customer/customerModel";

export class OrderController {
  constructor(
    private paymentGw: PaymentGW,
    private broker: MessageBroker,
  ) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    const {
      cart,
      couponCode,
      tenantId,
      paymentMode,
      customerId,
      comment,
      address,
    } = req.body;
    // todo: validate request data.

    const totalPrice = await this.calculateTotal(cart);

    let discountPercentage = 0;

    if (couponCode) {
      discountPercentage = await this.getDiscountPercentage(
        couponCode,
        tenantId,
      );
    }

    const discountAmount = Math.round((totalPrice * discountPercentage) / 100);

    const priceAfterDiscount = totalPrice - discountAmount;

    // todo: May be store in db for each tenant.
    const TAXES_PERCENT = 18;

    const taxes = Math.round((priceAfterDiscount * TAXES_PERCENT) / 100);
    // todo: may be store in database for each tenant or maybe calculated according to business rules.
    const DELIVERY_CHARGES = 100;

    const finalTotal = priceAfterDiscount + taxes + DELIVERY_CHARGES;

    const idempotencyKey = req.headers["idempotency-key"];

    const idempotency = await idempotencyModel.findOne({ key: idempotencyKey });

    let newOrder = idempotency ? [idempotency.response] : [];

    if (!idempotency) {
      const session = await mongoose.startSession();
      await session.startTransaction();

      try {
        newOrder = await orderModel.create(
          [
            {
              cart,
              address,
              comment,
              customerId,
              deliveryCharges: DELIVERY_CHARGES,
              discount: discountAmount,
              taxes,
              tenantId,
              total: finalTotal,
              paymentMode,
              orderStatus: OrderStatus.RECEIVED,
              paymentStatus: PaymentStatus.PENDING,
            },
          ],
          { session },
        );

        await idempotencyModel.create(
          [{ key: idempotencyKey, response: newOrder[0] }],
          { session },
        );

        await session.commitTransaction();
      } catch (err) {
        await session.abortTransaction();
        await session.endSession();

        return next(createHttpError(500, err.message));
      } finally {
        await session.endSession();
      }
    }

    // Payment processing...

    // todo: Error handling...
    const customer = await customerModel.findOne({
      _id: newOrder[0].customerId,
    });

    // todo: add logging
    const brokerMessage = {
      event_type: OrderEvents.ORDER_CREATE,
      data: { ...newOrder[0], customerId: customer },
    };

    if (paymentMode === PaymentMode.CARD) {
      const session = await this.paymentGw.createSession({
        amount: finalTotal,
        orderId: newOrder[0]._id.toString(),
        tenantId: tenantId,
        currency: "inr",
        idempotenencyKey: idempotencyKey as string,
      });

      await this.broker.sendMessage(
        "order",
        JSON.stringify(brokerMessage),
        newOrder[0]._id.toString(),
      );

      return res.json({ paymentUrl: session.paymentUrl });
    }

    await this.broker.sendMessage(
      "order",
      JSON.stringify(brokerMessage),
      newOrder[0]._id.toString(),
    );

    // todo: Update order document -> paymentId -> sessionId
    return res.json({ paymentUrl: null });
  };

  getAll = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { role, tenant: userTenantId } = req.auth;

    const tenantId = req.query.tenantId;

    if (role === ROLES.CUSTOMER) {
      return next(createHttpError(403, "Not allowed."));
    }

    if (role === ROLES.ADMIN) {
      const filter = {};

      if (tenantId) {
        filter["tenantId"] = tenantId;
      }

      // todo: VERY IMPORTANT. add pagination.
      const orders = await orderModel
        .find(filter, {}, { sort: { createdAt: -1 } })
        .populate("customerId")
        .exec();

      // todo: add logger
      return res.json(orders);
    }

    if (role === ROLES.MANAGER) {
      const orders = await orderModel
        .find({ tenantId: userTenantId }, {}, { sort: { createdAt: -1 } })
        .populate("customerId")
        .exec();

      return res.json(orders);
    }

    return next(createHttpError(403, "Not allowed."));
  };
  getMine = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.auth.sub;

    if (!userId) {
      return next(createHttpError(400, "No userId found."));
    }

    // todo: Add error handling.
    const customer = await customerModel.findOne({ userId });

    if (!customer) {
      return next(createHttpError(400, "No customer found."));
    }

    // todo: implement pagination.
    const orders = await orderModel.find(
      { customerId: customer._id },
      { cart: 0 },
    );

    return res.json(orders);
  };

  getSingle = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const orderId = req.params.orderId;
    const { sub: userId, role, tenant: tenantId } = req.auth;

    const fields = req.query.fields
      ? req.query.fields.toString().split(",")
      : []; // ["orderStatus", "paymentStatus"]

    const projection = fields.reduce(
      (acc, field) => {
        acc[field] = 1;
        return acc;
      },
      { customerId: 1 },
    );

    // {
    //   orderStatus: 1,
    //   PaymentStatus: 1,
    // }

    const order = await orderModel
      .findOne({ _id: orderId }, projection)
      .populate("customerId")
      .exec();
    if (!order) {
      return next(createHttpError(400, "Order does not exists."));
    }

    // What roles can access this endpoint: Admin, manager (for their own restaurant), customer (own order)
    if (role === "admin") {
      return res.json(order);
    }

    const myRestaurantOrder = order.tenantId === tenantId;
    if (role === "manager" && myRestaurantOrder) {
      return res.json(order);
    }

    if (role === "customer") {
      const customer = await customerModel.findOne({ userId });

      if (!customer) {
        return next(createHttpError(400, "No customer found."));
      }

      if (order.customerId._id.toString() === customer._id.toString()) {
        return res.json(order);
      }
    }

    return next(createHttpError(403, "Operation not permitted."));
  };

  changeStatus = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) => {
    const { role, tenant: tenantId } = req.auth;
    const orderId = req.params.orderId;

    if (role === ROLES.MANAGER || ROLES.ADMIN) {
      const order = await orderModel.findOne({ _id: orderId });
      if (!order) {
        return next(createHttpError(400, "Order not found."));
      }

      const isMyRestaurantOrder = order.tenantId === tenantId;

      if (role === ROLES.MANAGER && !isMyRestaurantOrder) {
        return next(createHttpError(403, "Not allowed."));
      }

      const updatedOrder = await orderModel.findOneAndUpdate(
        { _id: orderId },
        // todo: req.body.status <- Put proper validation.
        { orderStatus: req.body.status },
        { new: true },
      );

      const customer = await customerModel.findOne({
        _id: updatedOrder.customerId,
      });

      // todo: add logging
      const brokerMessage = {
        event_type: OrderEvents.ORDER_STATUS_UPDATE,
        data: { ...updatedOrder.toObject(), customerId: customer },
      };

      await this.broker.sendMessage(
        "order",
        JSON.stringify(brokerMessage),
        updatedOrder._id.toString(),
      );

      return res.json({ _id: updatedOrder._id });
    }

    return next(createHttpError(403, "Not allowed."));
  };

  private calculateTotal = async (cart: CartItem[]) => {
    const productIds = cart.map((item) => item._id);

    // todo: proper error handling..
    const productPricings = await productCacheModel.find({
      productId: {
        $in: productIds,
      },
    });

    // todo: What will happen if product does not exists in the cache
    // 1. call catalog service.
    // 2. Use price from cart <- BAD

    const cartToppingIds = cart.reduce((acc, item) => {
      return [
        ...acc,
        ...item.chosenConfiguration.selectedToppings.map(
          (topping) => topping.id,
        ),
      ];
    }, []);

    // todo: What will happen if topping does not exists in the cache
    const toppingPricings = await toppingCacheModel.find({
      toppingId: {
        $in: cartToppingIds,
      },
    });

    const totalPrice = cart.reduce((acc, curr) => {
      const cachedProductPrice = productPricings.find(
        (product) => product.productId === curr._id,
      );

      return (
        acc +
        curr.qty * this.getItemTotal(curr, cachedProductPrice, toppingPricings)
      );
    }, 0);

    return totalPrice;
  };

  private getItemTotal = (
    item: CartItem,
    cachedProductPrice: ProductPricingCache,
    toppingsPricings: ToppingPriceCache[],
  ) => {
    const toppingsTotal = item.chosenConfiguration.selectedToppings.reduce(
      (acc, curr) => {
        return acc + this.getCurrentToppingPrice(curr, toppingsPricings);
      },
      0,
    );

    const productTotal = Object.entries(
      item.chosenConfiguration.priceConfiguration,
    ).reduce((acc, [key, value]) => {
      const price =
        cachedProductPrice.priceConfiguration[key].availableOptions[value];
      return acc + price;
    }, 0);

    return productTotal + toppingsTotal;
  };

  private getCurrentToppingPrice = (
    topping: Topping,
    toppingPricings: ToppingPriceCache[],
  ) => {
    const currentTopping = toppingPricings.find(
      (current) => topping.id === current.toppingId,
    );

    if (!currentTopping) {
      // todo: Make sure the item is in the cache else, maybe call catalog service.
      return topping.price;
    }

    return currentTopping.price;
  };

  private getDiscountPercentage = async (
    couponCode: string,
    tenantId: string,
  ) => {
    const code = await couponModel.findOne({ code: couponCode, tenantId });

    if (!code) {
      return 0;
    }

    const currentDate = new Date();
    const couponDate = new Date(code.validUpto);

    if (currentDate <= couponDate) {
      return code.discount;
    }

    return 0;
  };
}
