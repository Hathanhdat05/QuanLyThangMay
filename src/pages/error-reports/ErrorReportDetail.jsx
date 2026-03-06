import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Descriptions, Spin, Typography, Button, Space, Tag, message } from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

const { Title } = Typography;

const TYPE_MAP = {
  maintenance: { label: 'Bảo trì', color: 'blue' },
  warranty: { label: 'Bảo hành', color: 'orange' },
};

const STATUS_MAP = {
  pending: { label: 'Chờ xử lý', color: 'default' },
  in_progress: { label: 'Đang xử lý', color: 'processing' },
  resolved: { label: 'Đã xử lý', color: 'success' },
  closed: { label: 'Đã đóng', color: 'purple' },
};

const PRIORITY_MAP = {
  low: { label: 'Thấp', color: 'green' },
  medium: { label: 'Trung bình', color: 'blue' },
  high: { label: 'Cao', color: 'orange' },
  critical: { label: 'Nghiêm trọng', color: 'red' },
};

export default function ErrorReportDetail() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();
  const { isAdmin } = useAuth();

  const formatDate = (val) => {
    if (!val) return '-';
    const d = dayjs(val);
    if (!d.isValid()) return '-';
    return d.format('DD-MM-YYYY');
  };

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      setLoading(true);
      const { data, error } = await api.get(`/error-reports/${id}`);
      if (!isMounted) return;
      if (error || !data) {
        message.error('Không tìm thấy báo lỗi');
        navigate('/error-reports');
        return;
      }
      setReport(data);
      setLoading(false);
    };

    run();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading || !report) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  const typeCfg = TYPE_MAP[report.type];
  const statusCfg = STATUS_MAP[report.status];
  const priorityCfg = PRIORITY_MAP[report.priority];

  return (
    <div>
      <Space style={{ marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/error-reports')}>
          Quay lại
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          Chi tiết báo lỗi
        </Title>
        {isAdmin && (
          <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/error-reports/${id}`)}>
            Sửa
          </Button>
        )}
      </Space>

      <Card>
        <Descriptions column={2} bordered size="middle">
          <Descriptions.Item label="ID báo lỗi" span={1}>
            {report.errorId || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Tiêu đề" span={1}>
            {report.title || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Loại" span={1}>
            {typeCfg ? <Tag color={typeCfg.color}>{typeCfg.label}</Tag> : report.type || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái" span={1}>
            {statusCfg ? <Tag color={statusCfg.color}>{statusCfg.label}</Tag> : report.status || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Mức độ ưu tiên" span={1}>
            {priorityCfg ? (
              <Tag color={priorityCfg.color}>{priorityCfg.label}</Tag>
            ) : (
              report.priority || '-'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Khách hàng" span={1}>
            {report.customers?.name || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Thang máy" span={1}>
            {report.elevators?.name || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Hợp đồng" span={1}>
            {report.contracts?.contract_number || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Ngày báo cáo" span={1}>
            {formatDate(report.reported_date)}
          </Descriptions.Item>
          <Descriptions.Item label="Ngày hẹn xử lý" span={1}>
            {formatDate(report.scheduled_date)}
          </Descriptions.Item>
          <Descriptions.Item label="Ngày hoàn thành" span={2}>
            {formatDate(report.completed_date)}
          </Descriptions.Item>
          <Descriptions.Item label="Mô tả chi tiết" span={2}>
            {report.description || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
}

