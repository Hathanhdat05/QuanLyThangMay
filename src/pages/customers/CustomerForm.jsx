import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Space, Spin, message, Select } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { api } from '../../lib/api';
import { provinces, districtsByProvince } from '../../data/vietnam-addresses';

const { Title } = Typography;
const { TextArea } = Input;

const regionOptions = [
  { value: 'Miền Bắc', label: 'Miền Bắc' },
  { value: 'Miền Trung', label: 'Miền Trung' },
  { value: 'Miền Nam', label: 'Miền Nam' },
];

const customerTypeOptions = [
  { value: 'individual', label: 'Cá nhân' },
  { value: 'business', label: 'Doanh nghiệp' },
];

export default function CustomerForm() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState('');
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      if (isEdit) {
        setLoading(true);
        const { data, error } = await api.get(`/customers/${id}`);
        if (!isMounted) return;
        if (error || !data) {
          message.error('Không tìm thấy khách hàng');
          navigate('/customers');
          return;
        }
        form.setFieldsValue({ customerType: 'individual', ...data });
        setSelectedProvince(data.province || '');
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await api.get('/customers/new-id');
      if (!isMounted) return;
      if (error || !data?.customerId) {
        message.error('Không thể tạo ID khách hàng tự động');
      } else {
        form.setFieldsValue({ customerId: data.customerId, customerType: 'individual' });
      }
      setLoading(false);
    };

    run();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const onFinish = async (values) => {
    setSaving(true);
    if (isEdit) {
      const { error } = await api.put(`/customers/${id}`, values);
      if (error) {
        message.error('Lỗi cập nhật khách hàng');
      } else {
        message.success('Đã cập nhật khách hàng');
        navigate('/customers');
      }
    } else {
      const { error } = await api.post('/customers', values);
      if (error) {
        message.error('Lỗi thêm khách hàng');
      } else {
        message.success('Đã thêm khách hàng');
        navigate('/customers');
      }
    }
    setSaving(false);
  };

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
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/customers')}>
          Quay lại
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          {isEdit ? 'Sửa khách hàng' : 'Thêm khách hàng'}
        </Title>
      </Space>

      <Card style={{ maxWidth: 700 }}>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="customerId" label="ID khách hàng">
            <Input placeholder="Hệ thống tự tạo" disabled />
          </Form.Item>

          <Form.Item
            name="customerType"
            label="Loại khách hàng"
            rules={[{ required: true, message: 'Vui lòng chọn loại khách hàng' }]}
          >
            <Select placeholder="Chọn loại khách hàng" options={customerTypeOptions} />
          </Form.Item>

          <Form.Item
            name="name"
            label="Tên khách hàng"
            rules={[{ required: true, message: 'Vui lòng nhập tên khách hàng' }]}
          >
            <Input placeholder="Nhập tên khách hàng" />
          </Form.Item>

          <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Email không hợp lệ' }]}>
            <Input placeholder="Nhập email" />
          </Form.Item>

          <Form.Item name="phone" label="Số điện thoại">
            <Input placeholder="Nhập số điện thoại" />
          </Form.Item>

          <Form.Item name="region" label="Khu vực">
            <Select placeholder="Chọn khu vực" allowClear options={regionOptions} />
          </Form.Item>

          <Form.Item name="province" label="Tỉnh / Thành phố">
            <Select
              placeholder="Chọn tỉnh/thành phố"
              allowClear
              showSearch
              optionFilterProp="label"
              options={provinces}
              onChange={(v) => {
                setSelectedProvince(v || '');
                form.setFieldValue('district', undefined);
              }}
            />
          </Form.Item>

          <Form.Item name="district" label="Quận / Huyện">
            <Select
              placeholder="Chọn quận/huyện"
              allowClear
              showSearch
              optionFilterProp="label"
              options={districtsByProvince[selectedProvince] ?? []}
              disabled={!selectedProvince}
            />
          </Form.Item>

          <Form.Item name="addressDetail" label="Địa chỉ chi tiết">
            <Input placeholder="Số nhà, tên đường, thôn/xóm..." />
          </Form.Item>

          <Form.Item name="note" label="Ghi chú">
            <TextArea rows={3} placeholder="Ghi chú thêm" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={saving}>
                {isEdit ? 'Cập nhật' : 'Thêm mới'}
              </Button>
              <Button onClick={() => navigate('/customers')}>Hủy</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
