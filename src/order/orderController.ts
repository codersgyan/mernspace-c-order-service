import { Request, Response } from "express";

export class OrderController {
  create = (req: Request, res: Response) => {
    return res.json({ success: true });
  };
}
