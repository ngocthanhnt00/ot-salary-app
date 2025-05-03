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
  Space,
  DatePicker,
  Typography,
  Badge,
  Avatar,
  Tooltip,
} from 'antd';
import {
  DeleteOutlined,
  EyeOutlined,
  SearchOutlined,
  ReloadOutlined,
  DownloadOutlined,
  ShoppingCartOutlined,
  UserOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import orderApi from '../../api/orderApi';
import moment from 'moment';
import 'moment/locale/vi';
import { CSVLink } from 'react-csv';

const { Title } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface Product {
  orderDetailId: string;
  productId: string | null;
  productName: string;
  productPrice: number;
  productImage: string | null;
  quantity: number;
  totalPrice: number;
}

interface Order {
  key: string;
  orderId: string;
  fullname: string;
  orderDate?: string;
  product: string;
  status: 'PENDING' | 'PROCESSING' | 'SHIPPING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  quantity?: number;
  price?: string;
  products?: Product[];
}

interface FilterParams {
  status?: string;
  dateRange?: [moment.Moment, moment.Moment] | null;
  search?: string;
}

const OrderList: React.FC = () => {
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [filters, setFilters] = useState<FilterParams>({});
  const [form] = Form.useForm();

  useEffect(() => {
    fetchOrders();
  }, [filters]);

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

      const orderDetails = response.data.result;
      const groupedOrders: { [key: string]: any } = {};

      orderDetails.forEach((detail: any) => {
        const orderId = detail.orderId._id;
        if (!groupedOrders[orderId]) {
          groupedOrders[orderId] = {
            orderId: orderId,
            orderDate: detail.orderId.order_date,
            status: detail.orderId.status,
            fullname: detail.orderId.userID?.fullname || 'Không xác định',
            total_price: detail.orderId.total_price,
            products: [],
          };
        }

        groupedOrders[orderId].products.push({
          orderDetailId: detail._id,
          productId: detail.productId?._id || null,
          productName: detail.productId?.name || 'Không xác định',
          productPrice: detail.product_price || 0,
          productImage: null,
          quantity: detail.quantity || 0,
          totalPrice: detail.total_price || 0,
        });
      });

      const formattedOrders: Order[] = Object.values(groupedOrders).map((order: any, index: number) => ({
        key: order.orderId || `order-${index}`,
        orderId: order.orderId || `ORDER${index}`,
        fullname: order.fullname,
        product: order.products.map((p: Product) => p.productName).join(', ') || 'Không xác định',
        status: (order.status || 'PENDING').toUpperCase() as Order['status'],
        quantity: order.products.reduce((sum: number, p: Product) => sum + p.quantity, 0) || 0,
        price: order.total_price?.toString() || '0',
        orderDate: order.orderDate ? moment(order.orderDate).format('DD/MM/YYYY HH:mm') : 'Không xác định',
        products: order.products,
      }));

      const filteredOrders = applyFilters(formattedOrders);
      setOrders(filteredOrders);
    } catch (error) {
      console.error('Error fetching orders:', error.response?.data || error.message);
      message.error('Tải danh sách đơn hàng thất bại');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (orderList: Order[]): Order[] => {
    return orderList.filter((order) => {
      let matches = true;

      if (filters.status) {
        matches = matches && order.status === filters.status;
      }

      if (filters.dateRange) {
        const orderDate = moment(order.orderDate, 'DD/MM/YYYY HH:mm');
        matches = matches && orderDate.isBetween(filters.dateRange[0], filters.dateRange[1], 'day', '[]');
      }

      if (filters.search) {
        const searchRegex = new RegExp(filters.search, 'i');
        matches = matches && (
          searchRegex.test(order.orderId) ||
          searchRegex.test(order.fullname)
        );
      }

      return matches;
    });
  };

  const handleSearch = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value }));
  };

  const handleStatusFilter = (status: string) => {
    setFilters((prev) => ({ ...prev, status: status || undefined }));
  };

  const handleDateRangeFilter = (dates: any) => {
    setFilters((prev) => ({ ...prev, dateRange: dates }));
  };

  const handleView = (record: Order) => {
    setSelectedOrder(record);
    form.setFieldsValue({ status: record.status });
    setIsModalVisible(true);
  };

  const handleDeleteAll = () => {
    if (selectedRows.length === 0) {
      message.warning('Vui lòng chọn ít nhất một đơn hàng để xóa!');
      return;
    }
    Modal.confirm({
      title: 'Xác nhận xóa',
      content: `Bạn có chắc chắn muốn xóa ${selectedRows.length} đơn hàng đã chọn?`,
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await Promise.all(selectedRows.map((id) => orderApi.delete(id)));
          message.success('Xóa đơn hàng thành công');
          await fetchOrders();
          setSelectedRows([]);
        } catch (error) {
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
        await orderApi.updateOrderStatus(selectedOrder.orderId, values.status);
        message.success('Cập nhật trạng thái thành công');
        await fetchOrders();
        setIsModalVisible(false);
      }
    } catch (error) {
      console.error('Error updating order status:', error.response?.data || error.message);
      message.error('Cập nhật trạng thái thất bại');
    }
  };

  const columns = [
    {
      title: (
        <Checkbox
          onChange={(e) => {
            const keys = e.target.checked ? orders.map((o) => o.key) : [];
            setSelectedRows(keys);
          }}
          checked={selectedRows.length === orders.length && orders.length > 0}
          indeterminate={selectedRows.length > 0 && selectedRows.length < orders.length}
        />
      ),
      dataIndex: 'checkbox',
      width: 50,
      render: (_: any, record: Order) => (
        <Checkbox
          checked={selectedRows.includes(record.key)}
          onChange={(e) => {
            const keys = e.target.checked
              ? [...selectedRows, record.key]
              : selectedRows.filter((k) => k !== record.key);
            setSelectedRows(keys);
          }}
        />
      ),
    },
    {
      title: 'STT',
      dataIndex: 'index',
      width: 70,
      render: (_: any, __: any, index: number) => (
        <span className="text-gray-600 font-medium">{index + 1}</span>
      ),
    },
    {
      title: 'Khách hàng',
      dataIndex: 'fullname',
      key: 'fullname',
      render: (text: string) => (
        <div className="flex items-center space-x-3">
          <Avatar 
            className="bg-blue-400"
            icon={<UserOutlined />}
          />
          <div>
            <div className="font-medium text-gray-800">{text}</div>
            <div className="text-xs text-gray-500">Khách hàng</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Thông tin đơn hàng',
      dataIndex: 'product',
      key: 'product',
      render: (text: string, record: Order) => (
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <ShoppingCartOutlined className="text-blue-500" />
            <span className="font-medium text-gray-800 truncate max-w-xs">
              {text}
            </span>
          </div>
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <CalendarOutlined />
            <span>{record.orderDate}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusConfig = {
          PENDING: { color: '#faad14', text: 'Chờ xử lý', dotColor: 'warning' },
          PROCESSING: { color: '#1890ff', text: 'Đang xử lý', dotColor: 'processing' },
          SHIPPING: { color: '#52c41a', text: 'Đang vận chuyển', dotColor: 'success' },
          SHIPPED: { color: '#13c2c2', text: 'Đã giao hàng', dotColor: 'success' },
          DELIVERED: { color: '#52c41a', text: 'Đã giao', dotColor: 'success' },
          CANCELLED: { color: '#ff4d4f', text: 'Đã hủy', dotColor: 'error' },
        };

        return (
          <Badge
            status={statusConfig[status]?.dotColor as any}
            text={
              <span style={{ color: statusConfig[status]?.color }}>
                {statusConfig[status]?.text}
              </span>
            }
          />
        );
      },
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_: any, record: Order) => (
        <Space>
          <Tooltip title="Xem chi tiết">
            <Button
              type="primary"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
              className="bg-blue-500 hover:bg-blue-600"
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="p-6 bg-gray-50 min-h-screen"
    >
      <div className="max-w-7xl mx-auto">
        <Card
          bordered={false}
          className="shadow-lg rounded-lg overflow-hidden"
          title={
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* <Title level={4} className="mb-0">
                Quản lý đơn hàng
              </Title> */}
              <div className="flex-1 lg:max-w-md">
                <Input.Search
                  placeholder="Tìm kiếm đơn hàng..."
                  allowClear
                  enterButton
                  onSearch={handleSearch}
                  className="rounded-lg"
                  size="large"
                />
              </div>
              <Space wrap className="flex-shrink-0">
                <Select
                  placeholder="Trạng thái"
                  allowClear
                  style={{ width: 150 }}
                  onChange={handleStatusFilter}
                  size="large"
                >
                  <Option value="PENDING">Chờ xử lý</Option>
                  <Option value="PROCESSING">Đang xử lý</Option>
                  <Option value="SHIPPING">Đang vận chuyển</Option>
                  <Option value="SHIPPED">Đã giao hàng</Option>
                  <Option value="DELIVERED">Đã giao</Option>
                  <Option value="CANCELLED">Đã hủy</Option>
                </Select>
                <RangePicker
                  onChange={handleDateRangeFilter}
                  format="DD/MM/YYYY"
                  size="large"
                  placeholder={['Ngày bắt đầu', 'Ngày kết thúc']}
                />
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => fetchOrders()}
                  size="large"
                  className="hover:bg-gray-50"
                >
                  Làm mới
                </Button>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleDeleteAll}
                  disabled={selectedRows.length === 0}
                  size="large"
                >
                  Xóa ({selectedRows.length})
                </Button>
                <CSVLink
                  data={orders}
                  filename="orders.csv"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <DownloadOutlined className="mr-2" />
                  Xuất CSV
                </CSVLink>
              </Space>
            </div>
          }
        >
          <Table
            columns={columns}
            dataSource={orders}
            loading={loading}
            pagination={{
              total: orders.length,
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `Tổng ${total} đơn hàng`,
              className: "mt-4"
            }}
            className="ant-table-custom"
            rowClassName="hover:bg-gray-50"
            scroll={{ x: true }}
          />
        </Card>

        <Modal
          title={
            <div className="flex items-center gap-3">
              <EyeOutlined className="text-blue-400" />
              <span className="text-[16px] font-medium text-gray-800">Chi tiết đơn hàng</span>
            </div>
          }
          open={isModalVisible}
          onOk={handleModalOk}
          onCancel={() => setIsModalVisible(false)}
          okText="Lưu thay đổi"
          cancelText="Hủy bỏ"
          width={600}
          className="top-8"
        >
          <AnimatePresence>
            {selectedOrder && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h3 className="font-medium text-gray-800 mb-4">Thông tin đơn hàng</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Mã đơn hàng</p>
                          <p className="text-sm font-medium text-gray-700">{selectedOrder.orderId}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Ngày đặt</p>
                          <p className="text-sm font-medium text-gray-700">{selectedOrder.orderDate}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2">
                    {selectedOrder?.products && selectedOrder.products.length > 0 ? (
                      <div className="p-4 bg-gray-50 rounded-lg max-h-60 overflow-y-auto">
                        <h3 className="font-medium text-gray-800 mb-4">Danh sách sản phẩm</h3>
                        {selectedOrder.products.map((product: Product, index: number) => (
                          <div key={index} className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                              <p className="text-sm text-gray-500">Tên sản phẩm</p>
                              <p className="text-sm font-medium text-gray-700">{product.productName}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Số lượng</p>
                              <p className="text-sm font-medium text-gray-700">{product.quantity}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Đơn giá</p>
                              <p className="text-sm font-medium text-gray-700">{product.productPrice.toLocaleString()} VNĐ</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Thành tiền</p>
                              <p className="text-sm font-medium text-gray-700">{product.totalPrice.toLocaleString()} VNĐ</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-500">Không có sản phẩm trong đơn hàng</p>
                      </div>
                    )}
                  </div>

                  <div className="col-span-2">
                    <Form form={form} layout="vertical">
                      <Form.Item
                        label="Cập nhật trạng thái"
                        name="status"
                        rules={[{ required: true, message: 'Vui lòng chọn trạng thái' }]}
                      >
                        <Select className="w-full">
                          <Option value="PENDING">Chờ xử lý</Option>
                          <Option value="PROCESSING">Đang xử lý</Option>
                          <Option value="SHIPPING">Đang vận chuyển</Option>
                          <Option value="SHIPPED">Đã giao hàng</Option>
                          <Option value="DELIVERED">Đã giao</Option>
                          <Option value="CANCELLED">Đã hủy</Option>
                        </Select>
                      </Form.Item>
                    </Form>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Modal>
      </div>
    </motion.div>
  );
};

export default OrderList;