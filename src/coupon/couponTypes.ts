export interface Coupon {
  id: string;
  title: string;
  code: string;
  validUpto: Date;
  tenantId: number;
  discount: number;
  createdAt: Date;
  updatedAt: Date;
}
