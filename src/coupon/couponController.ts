import { Request, Response } from "express";
import couponModel from "./couponModel";

export class CouponController {
  create = async (req: Request, res: Response) => {
    const { title, code, validUpto, discount, tenantId } = req.body;

    // todo: add request validation.
    // todo: check if creator is admin or a manger of that restaurant.

    // todo: add logging
    const coupon = await couponModel.create({
      title,
      code,
      discount,
      validUpto,
      tenantId,
    });

    return res.json(coupon);
  };

  // todo: Complete CRUD assignment. This will be used in dashboard.
}
