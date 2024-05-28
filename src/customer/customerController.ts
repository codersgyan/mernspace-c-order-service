import { Response } from "express";
import { Request } from "express-jwt";
import customerModel from "./customerModel";

export class CustomerController {
  getCustomer = async (req: Request, res: Response) => {
    // todo: add these fields to jwt in auth service.
    const { sub: userId, firstName, lastName, email } = req.auth;
    console.log("auth:", req.auth);
    // todo: implement service layer.
    const customer = await customerModel.findOne({ userId });

    if (!customer) {
      const newCustomer = await customerModel.create({
        userId,
        firstName,
        lastName,
        email,
        addresses: [],
      });

      // todo: add logging
      return res.json(newCustomer);
    }

    res.json(customer);
  };

  addAddress = async (req: Request, res: Response) => {
    const { sub: userId } = req.auth;

    // todo: add service layer.
    const customer = await customerModel.findOneAndUpdate(
      {
        _id: req.params.id,
        userId,
      },
      {
        $push: {
          addresses: {
            text: req.body.address,
            // todo: implement isDefault field in future.
            isDefault: false,
          },
        },
      },
      { new: true },
    );

    // todo: add logging
    return res.json(customer);
  };
}
