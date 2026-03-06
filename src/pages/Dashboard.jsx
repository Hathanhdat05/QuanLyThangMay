import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Typography, Table, Tag, Statistic, Spin, message, Alert } from 'antd';
import {
  TeamOutlined,
  FileTextOutlined,
  WarningOutlined,
  ToolOutlined,
  CalendarOutlined,
  ShoppingOutlined,
} from '@ant-design/icons';
import { api, apiConfigured } from '../lib/api';

const { Title } = Typography;

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

const TYPE_MAP = {
  maintenance: { label: 'Bảo trì', color: 'blue' },
  warranty: { label: 'Bảo hành', color: 'orange' },
};

export default function Dashboard() {
  const [stats, setStats] = useState({
    customers: 0,
    contracts: 0,
    products: 0,
    elevators: 0,
    pendingReports: 0,
    upcomingMaintenance: 0,
  });
  const [recentReports, setRecentReports] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    if (!apiConfigured) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await api.get('/dashboard');
      if (error) {
        message.error('Lỗi tải dữ liệu dashboard');
        setLoading(false);
        return;
      }
      setStats(data.stats || {});
      setRecentReports(data.recentReports || []);
      setUpcomingEvents(data.upcomingEvents || []);
    } catch {
      message.error('Lỗi tải dữ liệu dashboard');
    } finally {
      setLoading(false);
    }
  };

  const reportColumns = [
    {
      title: 'Tiêu đề',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text, record) => (
        <a onClick={() => navigate(`/error-reports/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: 'Loại',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (v) => {
        const t = TYPE_MAP[v] || { label: v, color: 'default' };
        return <Tag color={t.color}>{t.label}</Tag>;
      },
    },
    {
      title: 'Mức độ',
      dataIndex: 'priority',
      key: 'priority',
      width: 120,
      render: (v) => {
        const p = PRIORITY_MAP[v] || { label: v, color: 'default' };
        return <Tag color={p.color}>{p.label}</Tag>;
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (v) => {
        const s = STATUS_MAP[v] || { label: v, color: 'default' };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: 'Thang máy',
      key: 'elevator',
      render: (_, r) => r.elevators?.name || '-',
    },
  ];

  const upcomingColumns = [
    { title: 'Tiêu đề', dataIndex: 'title', key: 'title', ellipsis: true },
    {
      title: 'Ngày hẹn',
      dataIndex: 'scheduled_date',
      key: 'scheduled_date',
      render: (v) => (v ? (typeof v === 'string' ? v.split('T')[0] : v) : '-'),
    },
    {
      title: 'Khách hàng',
      key: 'customer',
      render: (_, r) => r.customers?.name || '-',
    },
    {
      title: 'Thang máy',
      key: 'elevator',
      render: (_, r) => r.elevators?.name || '-',
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        Dashboard
      </Title>

      {!apiConfigured && (
        <Alert
          message="Chưa cấu hình API"
          description={
            <>
              Thêm <code>VITE_API_URL=http://localhost:3001/api</code> vào file .env, chạy backend (
              <code>cd backend && npm run dev</code>), rồi khởi động lại <code>npm run dev</code> và refresh trang.
            </>
          }
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={12} sm={8} lg={4}>
          <Card hoverable onClick={() => navigate('/customers')}>
            <Statistic title="Khách hàng" value={stats.customers} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card hoverable onClick={() => navigate('/contracts')}>
            <Statistic title="Hợp đồng" value={stats.contracts} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card hoverable onClick={() => navigate('/products')}>
            <Statistic title="Sản phẩm" value={stats.products} prefix={<ShoppingOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card hoverable onClick={() => navigate('/elevators')}>
            <Statistic title="Thang máy" value={stats.elevators} prefix={<ToolOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card hoverable onClick={() => navigate('/error-reports')}>
            <Statistic
              title="Báo lỗi chờ xử lý"
              value={stats.pendingReports}
              prefix={<WarningOutlined />}
              valueStyle={{ color: stats.pendingReports > 0 ? '#cf1322' : undefined }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card hoverable onClick={() => navigate('/maintenance-calendar')}>
            <Statistic
              title="Lịch sắp tới"
              value={stats.upcomingMaintenance}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: stats.upcomingMaintenance > 0 ? '#1677ff' : undefined }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="Báo lỗi đang xử lý" style={{ marginBottom: 16 }}>
            <Table
              columns={reportColumns}
              dataSource={recentReports}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{ emptyText: 'Không có báo lỗi nào đang chờ xử lý' }}
              scroll={{ x: 'max-content' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Lịch bảo trì sắp tới">
            <Table
              columns={upcomingColumns}
              dataSource={upcomingEvents}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{ emptyText: 'Không có lịch bảo trì sắp tới' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
