import mongoose, { Schema, model } from 'mongoose';
import order from './order.model.js';
import product from './product.model.js';
import service from './service.model.js';

const orderDetailSchema = new Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    productId: { type: Schema.Types.ObjectId, ref: product, default: null }, // Không bắt buộc
    serviceId: { type: Schema.Types.ObjectId, ref: service, default: null }, // Không bắt buộc
    quantity: { type: Number, required: true },
    product_price: { type: Number, required: true }, // Thêm trường bắt buộc từ controller
    total_price: { type: Number, required: true },   // Thêm trường bắt buộc từ controller
    service_time: { type: Date, default: null }      // Thêm trường từ controller
  },
  { timestamps: true }
);

const orderDetailModel = mongoose.models.orderDetail || model('orderDetail', orderDetailSchema);

export default orderDetailModel;