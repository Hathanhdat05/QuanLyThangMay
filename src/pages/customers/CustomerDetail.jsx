import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Descriptions, Spin, Typography, Button, Space, message } from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

const { Title } = Typography;

export default function CustomerDetail() {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();
  const { isAdmin } = useAuth();

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      setLoading(true);
      const { data, error } = await api.get(`/customers/${id}`);
      if (!isMounted) return;
      if (error || !data) {
        message.error('Không tìm thấy khách hàng');
        navigate('/customers');
        return;
      }
      setCustomer(data);
      setLoading(false);
    };

    run();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading || !customer) {
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
          Chi tiết khách hàng
        </Title>
        {isAdmin && (
          <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/customers/${id}`)}>
            Sửa
          </Button>
        )}
      </Space>

      <Card style={{ maxWidth: 700 }}>
        <Descriptions column={1} bordered size="middle">
          <Descriptions.Item label="ID khách hàng">{customer.customerId || '-'}</Descriptions.Item>
          <Descriptions.Item label="Tên khách hàng">{customer.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="Loại khách hàng">
            {customer.customerType === 'business' ? 'Doanh nghiệp' : 'Cá nhân'}
          </Descriptions.Item>
          <Descriptions.Item label="Email">{customer.email || '-'}</Descriptions.Item>
          <Descriptions.Item label="Số điện thoại">{customer.phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="Khu vực">{customer.region || '-'}</Descriptions.Item>
          <Descriptions.Item label="Tỉnh / Thành phố">{customer.province || '-'}</Descriptions.Item>
          <Descriptions.Item label="Quận / Huyện">{customer.district || '-'}</Descriptions.Item>
          <Descriptions.Item label="Địa chỉ chi tiết">{customer.addressDetail || '-'}</Descriptions.Item>
          <Descriptions.Item label="Địa chỉ đầy đủ">{customer.address || '-'}</Descriptions.Item>
          <Descriptions.Item label="Ghi chú">{customer.note || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
}

