import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  Space,
  Spin,
  InputNumber,
  Select,
  DatePicker,
  Table,
  message,
  Divider,
} from 'antd';
import { ArrowLeftOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../../lib/api';

const { Title } = Typography;
const { TextArea } = Input;

export default function ContractForm() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [elevators, setElevators] = useState([]);
  const [lineItems, setLineItems] = useState([]);
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      await loadLookups();
      if (!isMounted) return;

      if (isEdit) {
        await loadContract();
        return;
      }

      setLoading(true);
      const { data, error } = await api.get('/contracts/new-number');
      if (!isMounted) return;
      if (error || !data?.contract_number) {
        message.error('Không thể tạo số hợp đồng tự động');
      } else {
        form.setFieldsValue({ contract_number: data.contract_number });
      }
      setLoading(false);
    };

    run();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const loadLookups = async () => {
    const [custRes, prodRes, elevatorRes] = await Promise.all([
      api.get('/customers'),
      api.get('/products'),
      api.get('/elevators'),
    ]);
    setCustomers(Array.isArray(custRes.data) ? custRes.data : []);
    setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
    setElevators(Array.isArray(elevatorRes.data) ? elevatorRes.data : []);
  };

  const loadContract = async () => {
    setLoading(true);
    const { data, error } = await api.get(`/contracts/${id}`);
    if (error || !data) {
      message.error('Không tìm thấy hợp đồng');
      navigate('/contracts');
      setLoading(false);
      return;
    }
    form.setFieldsValue({
      ...data,
      start_date: data.start_date ? dayjs(data.start_date) : null,
      end_date: data.end_date ? dayjs(data.end_date) : null,
    });
    setLineItems(
      (data.contract_products || []).map((cp, i) => ({
        key: i,
        item_type: cp.item_type || (cp.elevator_id ? 'elevator' : 'product'),
        product_id: cp.product_id || null,
        elevator_id: cp.elevator_id || null,
        quantity: cp.quantity,
        unit_price: cp.unit_price,
      }))
    );
    setLoading(false);
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        key: Date.now(),
        item_type: 'product',
        product_id: null,
        elevator_id: null,
        quantity: 1,
        unit_price: 0,
      },
    ]);
  };

  const removeLineItem = (key) => {
    setLineItems(lineItems.filter((item) => item.key !== key));
  };

  const updateLineItem = (key, field, value) => {
    setLineItems(
      lineItems.map((item) => {
        if (item.key !== key) return item;
        return { ...item, [field]: value };
      })
    );
  };

  const updateLineItemSelection = (key, type, id) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        const updated = {
          ...item,
          item_type: type,
          product_id: null,
          elevator_id: null,
        };
        if (type === 'product') {
          updated.product_id = id;
          const product = products.find((p) => p.id === id);
          if (product) updated.unit_price = Number(product.price) || 0;
        } else if (type === 'elevator') {
          updated.elevator_id = id;
        }
        return updated;
      })
    );
  };

  const getLineItemSelectValue = (item) => {
    if (item.item_type === 'elevator' && item.elevator_id) return `elevator:${item.elevator_id}`;
    if (item.product_id) return `product:${item.product_id}`;
    return undefined;
  };

  const totalValue = lineItems.reduce((sum, item) => sum + (item.quantity || 0) * (item.unit_price || 0), 0);

  const onFinish = async (values) => {
    setSaving(true);
    const payload = {
      customer_id: values.customer_id,
      contract_number: form.getFieldValue('contract_number') || values.contract_number,
      contract_type: values.contract_type,
      start_date: values.start_date?.format('YYYY-MM-DD') || null,
      end_date: values.end_date?.format('YYYY-MM-DD') || null,
      status: values.status || 'draft',
      total_value: totalValue,
      notes: values.notes || '',
      items: lineItems
        .filter((item) => item.product_id || item.elevator_id)
        .map((item) => ({
          contract_id: id,
          item_type: item.item_type || (item.elevator_id ? 'elevator' : 'product'),
          product_id: item.product_id || null,
          elevator_id: item.elevator_id || null,
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
        })),
    };

    if (isEdit) {
      const { error } = await api.put(`/contracts/${id}`, payload);
      if (error) {
        message.error('Lỗi cập nhật hợp đồng');
        setSaving(false);
        return;
      }
    } else {
      const { error } = await api.post('/contracts', payload);
      if (error) {
        message.error('Lỗi thêm hợp đồng');
        setSaving(false);
        return;
      }
    }
    message.success(isEdit ? 'Đã cập nhật hợp đồng' : 'Đã thêm hợp đồng');
    navigate('/contracts');
    setSaving(false);
  };

  const lineColumns = [
    {
      title: 'Sản phẩm',
      dataIndex: 'product_id',
      key: 'product_id',
      width: '35%',
      render: (val, record) => (
        <Select
          value={getLineItemSelectValue(record)}
          onChange={(v) => {
            const [type, id] = String(v || '').split(':');
            if (type && id) {
              updateLineItemSelection(record.key, type === 'elevator' ? 'elevator' : 'product', id);
            } else {
              updateLineItemSelection(record.key, 'product', null);
            }
          }}
          placeholder="Chọn sản phẩm"
          style={{ width: '100%' }}
          showSearch
          optionFilterProp="label"
          options={[
            {
              label: 'Sản phẩm',
              options: products.map((p) => ({
                value: `product:${p.id}`,
                label: `${p.name} (${p.unit})`,
              })),
            },
            {
              label: 'Thang máy',
              options: elevators.map((e) => ({
                value: `elevator:${e.id}`,
                label: e.name,
              })),
            },
          ]}
        />
      ),
    },
    {
      title: 'Số lượng',
      dataIndex: 'quantity',
      key: 'quantity',
      width: '15%',
      render: (val, record) => (
        <InputNumber
          value={val}
          min={1}
          onChange={(v) => updateLineItem(record.key, 'quantity', v)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Đơn giá (VNĐ)',
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: '25%',
      render: (val, record) => (
        <InputNumber
          value={val}
          min={0}
          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={(v) => v.replace(/,/g, '')}
          onChange={(v) => updateLineItem(record.key, 'unit_price', v)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Thành tiền',
      key: 'total',
      width: '15%',
      render: (_, record) =>
        ((record.quantity || 0) * (record.unit_price || 0)).toLocaleString('vi-VN') + ' đ',
    },
    {
      title: '',
      key: 'action',
      width: '10%',
      render: (_, record) => (
        <Button type="link" danger icon={<DeleteOutlined />} onClick={() => removeLineItem(record.key)} />
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Space style={{ marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/contracts')}>
          Quay lại
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          {isEdit ? 'Sửa hợp đồng' : 'Thêm hợp đồng'}
        </Title>
      </Space>

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{ status: 'draft', contract_type: 'installation' }}
      >
        <Card title="Thông tin hợp đồng" style={{ marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="contract_number" label="Số hợp đồng">
              <Input disabled placeholder={isEdit ? undefined : 'Hệ thống tự tạo'} />
            </Form.Item>

            <Form.Item
              name="customer_id"
              label="Khách hàng"
              rules={[{ required: true, message: 'Vui lòng chọn khách hàng' }]}
            >
              <Select
                placeholder="Chọn khách hàng"
                showSearch
                optionFilterProp="label"
                options={customers.map((c) => ({
                  value: c.id,
                  label: `${c.name}${c.customerId ? ` (ID: ${c.customerId})` : ` (ID: ${c.id})`}`,
                }))}
              />
            </Form.Item>

            <Form.Item
              name="contract_type"
              label="Loại hợp đồng"
              rules={[{ required: true, message: 'Vui lòng chọn loại hợp đồng' }]}
            >
              <Select
                placeholder="Chọn loại hợp đồng"
                options={[
                  { value: 'installation', label: 'Lắp đặt' },
                  { value: 'maintenance', label: 'Bảo trì' },
                  { value: 'warranty', label: 'Bảo hành' },
                ]}
              />
            </Form.Item>

            <Form.Item name="start_date" label="Ngày bắt đầu">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>

            <Form.Item name="end_date" label="Ngày kết thúc">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>

            <Form.Item name="status" label="Trạng thái">
              <Select
                options={[
                  { value: 'draft', label: 'Nháp' },
                  { value: 'active', label: 'Đang thực hiện' },
                  { value: 'completed', label: 'Hoàn thành' },
                  { value: 'cancelled', label: 'Đã hủy' },
                ]}
              />
            </Form.Item>
          </div>

          <Form.Item name="notes" label="Ghi chú">
            <TextArea rows={2} placeholder="Ghi chú hợp đồng" />
          </Form.Item>
        </Card>

        <Card
          title="Sản phẩm trong hợp đồng"
          extra={
            <Button type="dashed" icon={<PlusOutlined />} onClick={addLineItem}>
              Thêm sản phẩm
            </Button>
          }
          style={{ marginBottom: 24 }}
        >
          <Table
            columns={lineColumns}
            dataSource={lineItems}
            rowKey="key"
            pagination={false}
            locale={{ emptyText: 'Chưa có sản phẩm nào. Nhấn "Thêm sản phẩm" để thêm.' }}
          />
          <Divider />
          <div style={{ textAlign: 'right', fontSize: 16, fontWeight: 600 }}>
            Tổng cộng: {totalValue.toLocaleString('vi-VN')} đ
          </div>
        </Card>

        <Space>
          <Button type="primary" htmlType="submit" loading={saving} size="large">
            {isEdit ? 'Cập nhật' : 'Thêm mới'}
          </Button>
          <Button size="large" onClick={() => navigate('/contracts')}>
            Hủy
          </Button>
        </Space>
      </Form>
    </div>
  );
}
