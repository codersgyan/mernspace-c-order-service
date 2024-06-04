import { ProductMessage } from "../types";
import productCacheModel from "./productCacheModel";

export const handleProductUpdate = async (value: string) => {
  // todo: wrap this parsing in try catch
  const product: ProductMessage = JSON.parse(value);

  return await productCacheModel.updateOne(
    {
      productId: product.id,
    },
    {
      $set: {
        priceConfiguration: product.priceConfiguration,
      },
    },
    { upsert: true },
  );
};
