import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Typography,
  Table,
  Tag,
  Statistic,
  Skeleton,
  message,
  Alert,
  Button,
  Space,
  theme,
} from 'antd';
import {
  TeamOutlined,
  FileTextOutlined,
  WarningOutlined,
  ToolOutlined,
  CalendarOutlined,
  ShoppingOutlined,
  RightOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { api, apiConfigured } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

const { Title, Text } = Typography;

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

const STAT_CARD_CONFIG = [
  {
    key: 'customers',
    title: 'Khách hàng',
    icon: TeamOutlined,
    path: '/customers',
    color: '#1677ff',
    bg: 'linear-gradient(135deg, #e6f4ff 0%, #bae0ff 100%)',
  },
  {
    key: 'contracts',
    title: 'Hợp đồng',
    icon: FileTextOutlined,
    path: '/contracts',
    color: '#52c41a',
    bg: 'linear-gradient(135deg, #f6ffed 0%, #b7eb8f 100%)',
  },
  {
    key: 'products',
    title: 'Sản phẩm',
    icon: ShoppingOutlined,
    path: '/products',
    color: '#722ed1',
    bg: 'linear-gradient(135deg, #f9f0ff 0%, #d3adf7 100%)',
  },
  {
    key: 'elevators',
    title: 'Thang máy',
    icon: ToolOutlined,
    path: '/elevators',
    color: '#fa8c16',
    bg: 'linear-gradient(135deg, #fff7e6 0%, #ffd591 100%)',
  },
  {
    key: 'pendingReports',
    title: 'Báo lỗi chờ xử lý',
    icon: WarningOutlined,
    path: '/error-reports',
    color: '#ff4d4f',
    bg: 'linear-gradient(135deg, #fff2f0 0%, #ffccc7 100%)',
  },
  {
    key: 'upcomingMaintenance',
    title: 'Lịch sắp tới',
    icon: CalendarOutlined,
    path: '/maintenance-calendar',
    color: '#13c2c2',
    bg: 'linear-gradient(135deg, #e6fffb 0%, #87e8de 100%)',
  },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Chào buổi sáng';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

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
  const { profile } = useAuth();
  const { token } = theme.useToken();

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
        <a onClick={() => navigate(`/error-reports/${record.id}/detail`)}>{text}</a>
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
      <div>
        <Skeleton.Input active size="large" style={{ width: 280, marginBottom: 8 }} />
        <Skeleton.Input active style={{ width: 200, marginBottom: 32 }} />
        <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Col xs={12} sm={8} lg={4} key={i}>
              <Card>
                <Skeleton active paragraph={{ rows: 2 }} />
              </Card>
            </Col>
          ))}
        </Row>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <Card>
              <Skeleton active paragraph={{ rows: 5 }} />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card>
              <Skeleton active paragraph={{ rows: 5 }} />
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <Title level={4} style={{ margin: 0, marginBottom: 4, fontWeight: 600 }}>
          {getGreeting()}, {profile?.full_name || 'Bạn'}!
        </Title>
        <Text type="secondary" style={{ fontSize: 14 }}>
          Tổng quan hoạt động quản lý thang máy của bạn
        </Text>
      </div>

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
          icon={<ExclamationCircleOutlined />}
          style={{ marginBottom: 24 }}
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        {STAT_CARD_CONFIG.map(({ key, title, icon: Icon, path, color, bg }) => {
          const value = stats[key] ?? 0;
          const isAlert = (key === 'pendingReports' && value > 0) || (key === 'upcomingMaintenance' && value > 0);
          return (
            <Col xs={12} sm={8} lg={4} key={key}>
              <Card
                hoverable
                onClick={() => navigate(path)}
                style={{
                  background: bg,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                styles={{
                  body: { padding: '20px 24px' },
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = token.boxShadowSecondary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <Statistic
                  title={<Text style={{ color: token.colorTextSecondary, fontSize: 13 }}>{title}</Text>}
                  value={value}
                  prefix={<Icon style={{ color, fontSize: 20 }} />}
                  valueStyle={{
                    color: isAlert ? (key === 'pendingReports' ? '#ff4d4f' : '#1677ff') : color,
                    fontWeight: 600,
                    fontSize: 24,
                  }}
                />
              </Card>
            </Col>
          );
        })}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <WarningOutlined style={{ color: token.colorWarning }} />
                <span>Báo lỗi đang xử lý</span>
              </Space>
            }
            extra={
              <Button type="link" size="small" onClick={() => navigate('/error-reports')} style={{ padding: 0 }}>
                Xem tất cả <RightOutlined />
              </Button>
            }
            style={{ marginBottom: 16 }}
          >
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
          <Card
            title={
              <Space>
                <CalendarOutlined style={{ color: token.colorPrimary }} />
                <span>Lịch bảo trì sắp tới</span>
              </Space>
            }
            extra={
              <Button type="link" size="small" onClick={() => navigate('/maintenance-calendar')} style={{ padding: 0 }}>
                Xem tất cả <RightOutlined />
              </Button>
            }
          >
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
