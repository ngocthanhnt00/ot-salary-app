import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Checkbox,
  Modal,
  Input,
  Select,
  Tag,
  Form,
  message,
} from 'antd';
import { DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import { Typography } from 'antd';
import orderApi from '../../api/orderApi';

const { Title } = Typography;
const { Option } = Select;

interface Order {
  key: string;
  orderId: string;
  fullname: string;
  orderDate?: string;
  product: string;
  status: string;
  quantity?: number;
  price?: string;
}

const OrderList: React.FC = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await orderApi.getAll();
      console.log('Full API response:', response);

      if (!response.data || !response.data.result) {
        console.error('API response is missing data or result:', response);
        message.error('Không thể tải danh sách đơn hàng');
        setOrders([]);
        return;
      }

      const orderList = response.data.result;
      if (!Array.isArray(orderList)) {
        console.error('API result is not an array:', orderList);
        message.error('Dữ liệu đơn hàng không hợp lệ');
        setOrders([]);
        return;
      }

      const formattedOrders = orderList.map((order: any, index: number) => ({
        key: order._id || index.toString(),
        orderId: order._id || `ORDER_${index}`,
        fullname: order.userID?.fullname || order.fullname || 'Không xác định',
        product: order.product || 'Không xác định',
        status: order.status || 'PENDING',
        quantity: order.quantity || 0,
        price: order.total_price?.toString() || '0',
      }));
      setOrders(formattedOrders);
    } catch (error: any) {
      console.error('Error fetching orders:', error.response?.data || error.message);
      message.error(
        error.response?.status === 404
          ? 'Không tìm thấy API đơn hàng'
          : 'Tải danh sách đơn hàng thất bại'
      );
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: (
        <Checkbox
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedRows(orders.map((order) => order.key));
            } else {
              setSelectedRows([]);
            }
          }}
        />
      ),
      dataIndex: 'checkbox',
      width: 50,
      render: (_: any, record: Order) => (
        <Checkbox
          checked={selectedRows.includes(record.key)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedRows([...selectedRows, record.key]);
            } else {
              setSelectedRows(selectedRows.filter((key) => key !== record.key));
            }
          }}
        />
      ),
    },
    { title: 'ID đơn hàng', dataIndex: 'orderId', key: 'orderId' },
    {
      title: 'Khách hàng',
      dataIndex: 'fullname',
      key: 'fullname',
      render: (fullname: string) => fullname || 'Không xác định',
    },
    { title: 'Đơn hàng', dataIndex: 'product', key: 'product' },
    {
      title: 'Tình trạng',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'DELIVERED' ? 'success' : 'processing'}>
          {status === 'DELIVERED'
            ? 'Đã giao'
            : status === 'PENDING'
            ? 'Chờ xử lý'
            : status === 'CONFIRMED'
            ? 'Đã xác nhận'
            : status === 'SHIPPING'
            ? 'Đang vận chuyển'
            : status === 'CANCELLED'
            ? 'Đã hủy'
            : status}
        </Tag>
      ),
    },
    {
      title: 'Tính năng',
      key: 'action',
      render: (_: any, record: Order) => (
        <Button
          icon={<EyeOutlined />}
          onClick={() => handleView(record)}
          size="small"
        />
      ),
    },
  ];

  const handleView = (record: Order) => {
    setSelectedOrder(record);
    form.setFieldsValue({ status: record.status });
    setIsModalVisible(true);
  };

  const handleDeleteAll = () => {
    if (selectedRows.length === 0) {
      Modal.warning({
        title: 'Cảnh báo',
        content: 'Vui lòng chọn ít nhất một đơn hàng để xóa!',
      });
      return;
    }
    Modal.confirm({
      title: 'Cảnh báo',
      content: 'Bạn có chắc chắn muốn xóa tất cả đơn hàng đã chọn?',
      okText: 'Đồng ý',
      cancelText: 'Hủy bỏ',
      onOk: async () => {
        try {
          await Promise.all(selectedRows.map((id) => orderApi.delete(id)));
          message.success('Xóa đơn hàng thành công');
          await fetchOrders();
          setSelectedRows([]);
        } catch (error: any) {
          console.error('Error deleting orders:', error.response?.data || error.message);
          message.error('Xóa đơn hàng thất bại');
        }
      },
    });
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (selectedOrder) {
        console.log('Updating order ID:', selectedOrder.orderId);
        await orderApi.update(selectedOrder.orderId, { status: values.status });
        message.success('Cập nhật trạng thái thành công');
        await fetchOrders();
        setIsModalVisible(false);
      }
    } catch (error: any) {
      console.error('Error updating order status:', error.response?.data || error.message);
      if (error.response?.status === 404) {
        message.error('Đơn hàng không tồn tại hoặc không thể cập nhật');
      } else if (error.response?.status === 405) {
        message.error('Phương thức cập nhật không được hỗ trợ');
      } else {
        message.error('Cập nhật trạng thái thất bại');
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card
        bordered={false}
        className="shadow-sm"
        extra={
          <div className="space-x-2">
            <Button danger icon={<DeleteOutlined />} onClick={handleDeleteAll}>
              Xóa tất cả
            </Button>
          </div>
        }
      >
        <Table
          columns={columns}
          dataSource={orders}
          loading={loading}
          pagination={{ pageSize: 10 }}
          className="overflow-x-auto"
        />
      </Card>

      <Modal
        title="Chi tiết thông tin đơn hàng"
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => setIsModalVisible(false)}
        okText="Lưu lại"
        cancelText="Hủy bỏ"
      >
        {selectedOrder && (
          <div className="space-y-4">
            <Input
              addonBefore="ID đơn hàng"
              value={selectedOrder.orderId}
              disabled
            />
            <Input
              addonBefore="Khách hàng"
              value={selectedOrder.fullname}
              disabled
            />
            <Input
              addonBefore="Đơn hàng"
              value={selectedOrder.product}
              disabled
            />
            <Input
              addonBefore="Số lượng"
              type="number"
              value={selectedOrder.quantity}
              disabled
            />
            <Input
              addonBefore="Giá (VNĐ)"
              value={selectedOrder.price}
              disabled
            />
            <Form form={form} layout="vertical">
              <Form.Item
                label="Tình trạng"
                name="status"
                rules={[{ required: true, message: 'Vui lòng chọn trạng thái' }]}
              >
                <Select className="w-full">
                  <Option value="DELIVERED">Đã giao</Option>
                  <Option value="PENDING">Chờ xử lý</Option>
                  <Option value="CONFIRMED">Đã xác nhận</Option>
                  <Option value="SHIPPING">Đang vận chuyển</Option>
                  <Option value="CANCELLED">Đã hủy</Option>
                </Select>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </motion.div>
  );
};

export default OrderList;