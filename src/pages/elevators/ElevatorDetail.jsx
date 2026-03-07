import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Card, Descriptions, Spin, Typography, Button, Space, message, Image } from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import { api, getImageUrl } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import dayjs from 'dayjs';

const { Title } = Typography;

export default function ElevatorDetail() {
  const [elevator, setElevator] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const fromContractId = location.state?.fromContractId;

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      setLoading(true);
      const { data, error } = await api.get(`/elevators/${id}`);
      if (!isMounted) return;
      if (error || !data) {
        message.error('Không tìm thấy thang máy');
        navigate('/elevators');
        return;
      }
      setElevator(data);
      setLoading(false);
    };

    run();

    return () => {
      isMounted = false;
    };
  }, [id, navigate]);

  if (loading || !elevator) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  const formatDate = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '-');

  return (
    <div>
      <Space style={{ marginBottom: 24 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(fromContractId ? `/contracts/${fromContractId}/detail` : '/elevators')}
        >
          Quay lại
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          Chi tiết thang máy
        </Title>
        {isAdmin && (
          <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/elevators/${id}`)}>
            Sửa
          </Button>
        )}
      </Space>

      <Card style={{ maxWidth: 700 }}>
        {elevator.image_url && (
          <div style={{ marginBottom: 24 }}>
            <Image
              src={getImageUrl(elevator.image_url)}
              alt={elevator.name}
              style={{ maxHeight: 300, objectFit: 'contain' }}
              fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='150' viewBox='0 0 200 150'%3E%3Crect fill='%23f0f0f0' width='200' height='150'/%3E%3Ctext fill='%23999' x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='14'%3EThang máy%3C/text%3E%3C/svg%3E"
            />
          </div>
        )}
        <Descriptions column={1} bordered size="middle">
          <Descriptions.Item label="ID thang máy">{elevator.elevatorId || '-'}</Descriptions.Item>
          <Descriptions.Item label="Tên">{elevator.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="Loại">{elevator.type || '-'}</Descriptions.Item>
          <Descriptions.Item label="Thương hiệu">{elevator.brand || '-'}</Descriptions.Item>
          <Descriptions.Item label="Model">{elevator.model || '-'}</Descriptions.Item>
          <Descriptions.Item label="Tải trọng (kg)">{elevator.capacity ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Tốc độ (m/s)">{elevator.speed ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Mô tả">{elevator.description || '-'}</Descriptions.Item>
          <Descriptions.Item label="Chu kỳ bảo trì (tháng)">
            {elevator.maintenance_months != null ? elevator.maintenance_months : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Tần suất bảo trì (tháng/lần)">
            {elevator.maintenance_frequency_per_month != null
              ? `${elevator.maintenance_frequency_per_month} tháng/lần`
              : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
}
